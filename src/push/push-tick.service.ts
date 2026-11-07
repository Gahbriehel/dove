import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfessionStatus, ScriptureStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PushTopic } from './dto/subscribe.dto';
import { PushService } from './push.service';
import {
  diffDays,
  formatOffsetMinutes,
  formatTime12h,
  getLagosTimeParts,
  lagosTimeToUtc,
  stripMarkdownAndTruncate,
} from './utils/push-time.util';

export interface TickCandidate {
  churchId: string;
  key: string;
  topic: PushTopic;
  title: string;
  body: string;
  url: string;
  tag: string;
  dueInstant: Date;
  afterSend?: () => Promise<void>;
}

@Injectable()
export class PushTickService {
  private readonly logger = new Logger(PushTickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Verify the Cron secret header in constant time.
   */
  verifyCronSecret(authHeader?: string): void {
    const cronSecret = this.configService.get<string>('push.cronSecret');
    if (!cronSecret) {
      throw new UnauthorizedException('CRON_SECRET is not configured');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const token = authHeader.slice(7);
    const tokenBuf = Buffer.from(token, 'utf8');
    const secretBuf = Buffer.from(cronSecret, 'utf8');

    if (tokenBuf.length !== secretBuf.length) {
      throw new UnauthorizedException('Invalid cron secret');
    }

    if (!crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }

  /**
   * Process a tick:
   * Build candidates, filter due ones in the 10 min window, claim atomically in notification_log,
   * trigger background send, and return claimed keys.
   */
  async processTick(now: Date = new Date()): Promise<{
    claimed: string[];
    at: string;
  }> {
    const { dateStr: lagosDateStr, dayOfWeek: lagosDayOfWeek } =
      getLagosTimeParts(now);

    const candidates = await this.buildCandidates(
      lagosDateStr,
      lagosDayOfWeek,
      now,
    );

    // Keep the ones that are due: due <= now and now - due <= 10 minutes
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const nowMs = now.getTime();
    const dueCandidates = candidates.filter((c) => {
      const dueMs = c.dueInstant.getTime();
      return dueMs <= nowMs && nowMs - dueMs <= TEN_MINUTES_MS;
    });

    // Claim each one atomically via NotificationLog unique key constraint
    const claimed: TickCandidate[] = [];
    for (const c of dueCandidates) {
      try {
        await this.prisma.notificationLog.create({
          data: {
            churchId: c.churchId,
            key: c.key,
            topic: c.topic,
            title: c.title,
            body: c.body,
            url: c.url,
            recipients: 0,
            delivered: 0,
            failed: 0,
          },
        });
        claimed.push(c);
      } catch (err: unknown) {
        const errorObj = err as { code?: string; message?: string };
        if (
          errorObj?.code === 'P2002' ||
          errorObj?.message?.includes('Unique constraint failed')
        ) {
          // Key already claimed or sent
          continue;
        }
        this.logger.error(`Error claiming key ${c.key}:`, err);
      }
    }

    // Dispatch claimed pushes in background
    if (claimed.length > 0) {
      setImmediate(() => {
        this.dispatchClaimed(claimed).catch((err) => {
          this.logger.error('Background push tick dispatch failed', err);
        });
      });
    }

    return {
      claimed: claimed.map((c) => c.key),
      at: now.toISOString(),
    };
  }

  /**
   * Send notifications for claimed candidates in batches of 50.
   */
  async dispatchClaimed(claimed: TickCandidate[]): Promise<void> {
    for (const candidate of claimed) {
      try {
        const subscriptions = await this.prisma.pushSubscription.findMany({
          where: { churchId: candidate.churchId },
        });

        const targetSubs = subscriptions.filter((sub) => {
          const topics = Array.isArray(sub.topics)
            ? (sub.topics as string[])
            : [];
          return topics.includes(candidate.topic);
        });

        let delivered = 0;
        let failed = 0;

        if (targetSubs.length > 0) {
          const BATCH_SIZE = 50;
          for (let i = 0; i < targetSubs.length; i += BATCH_SIZE) {
            const batch = targetSubs.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
              batch.map((sub) =>
                this.pushService.sendToSubscription(sub, {
                  title: candidate.title,
                  body: candidate.body,
                  url: candidate.url,
                  tag: candidate.tag,
                  topic: candidate.topic,
                }),
              ),
            );

            for (const r of results) {
              if (r.status === 'fulfilled' && r.value === true) {
                delivered++;
              } else {
                failed++;
              }
            }
          }
        }

        await this.prisma.notificationLog.update({
          where: { key: candidate.key },
          data: {
            recipients: targetSubs.length,
            delivered,
            failed,
          },
        });

        if (candidate.afterSend) {
          await candidate.afterSend();
        }
      } catch (err) {
        this.logger.error(`Failed to dispatch push ${candidate.key}:`, err);
      }
    }
  }

  /**
   * Build candidate pushes for today.
   */
  async buildCandidates(
    lagosDateStr: string,
    lagosDayOfWeek: number,
    now: Date,
  ): Promise<TickCandidate[]> {
    const candidates: TickCandidate[] = [];

    // 1. Night Prayer
    await this.collectNightPrayerCandidates(
      lagosDateStr,
      lagosDayOfWeek,
      candidates,
    );

    // 2. Confession Reminders
    await this.collectConfessionCandidates(
      lagosDateStr,
      lagosDayOfWeek,
      candidates,
    );

    // 3. Scriptures
    await this.collectScriptureCandidates(lagosDateStr, now, candidates);

    // 4. Encouragement
    await this.collectEncouragementCandidates(
      lagosDateStr,
      lagosDayOfWeek,
      candidates,
    );

    return candidates;
  }

  private async collectNightPrayerCandidates(
    lagosDateStr: string,
    lagosDayOfWeek: number,
    candidates: TickCandidate[],
  ): Promise<void> {
    const nightPrayers = await this.prisma.nightPrayer.findMany({
      where: { isActive: true },
      include: { exceptions: true },
    });

    for (const prayer of nightPrayers) {
      const daysOfWeek: number[] = Array.isArray(prayer.daysOfWeek)
        ? (prayer.daysOfWeek as unknown as number[])
        : [];
      if (!daysOfWeek.includes(lagosDayOfWeek)) {
        continue;
      }

      // Check if cancelled by exception today
      const todayException = prayer.exceptions.find(
        (e) => e.date.toISOString().slice(0, 10) === lagosDateStr,
      );
      if (todayException?.cancelled) {
        continue;
      }

      const startsAt = lagosTimeToUtc(lagosDateStr, prayer.timeOfDay);

      // On-time push: key night-prayer:{date}:0
      candidates.push({
        churchId: prayer.churchId,
        key: `night-prayer:${lagosDateStr}:0`,
        topic: 'night-prayer',
        title: 'Night Prayer is starting',
        body: 'Tap to join.',
        url: '/',
        tag: 'night-prayer',
        dueInstant: startsAt,
      });

      // Reminder offsets: key night-prayer:{date}:-{offset}
      const offsets: number[] = Array.isArray(prayer.reminderOffsetsMin)
        ? (prayer.reminderOffsetsMin as unknown as number[])
        : [];
      const formattedTime = formatTime12h(prayer.timeOfDay);

      for (const offset of offsets) {
        const offsetDue = new Date(startsAt.getTime() - offset * 60_000);
        candidates.push({
          churchId: prayer.churchId,
          key: `night-prayer:${lagosDateStr}:-${offset}`,
          topic: 'night-prayer',
          title: `Night Prayer in ${formatOffsetMinutes(offset)}`,
          body: `Join us at ${formattedTime}. Tap to open.`,
          url: '/',
          tag: 'night-prayer',
          dueInstant: offsetDue,
        });
      }
    }
  }

  private async collectConfessionCandidates(
    lagosDateStr: string,
    lagosDayOfWeek: number,
    candidates: TickCandidate[],
  ): Promise<void> {
    const reminders = await this.prisma.confessionReminder.findMany({
      where: {
        confession: {
          status: ConfessionStatus.PUBLISHED,
        },
      },
      include: {
        confession: true,
      },
    });

    for (const rem of reminders) {
      const days: number[] = Array.isArray(rem.daysOfWeek)
        ? (rem.daysOfWeek as unknown as number[])
        : [];
      if (days.length > 0 && !days.includes(lagosDayOfWeek)) {
        continue;
      }

      if (rem.startsOn) {
        const startsOnStr = rem.startsOn.toISOString().slice(0, 10);
        if (lagosDateStr < startsOnStr) {
          continue;
        }
      }

      if (rem.endsOn) {
        const endsOnStr = rem.endsOn.toISOString().slice(0, 10);
        if (lagosDateStr > endsOnStr) {
          continue;
        }
      }

      const dueInstant = lagosTimeToUtc(lagosDateStr, rem.timeOfDay);
      const bodyText =
        rem.message ||
        rem.confession.scriptureRef ||
        stripMarkdownAndTruncate(rem.confession.body, 150);

      candidates.push({
        churchId: rem.confession.churchId,
        key: `confession:${rem.id}:${lagosDateStr}`,
        topic: 'confessions',
        title: rem.confession.title,
        body: bodyText,
        url: `/confessions/${rem.confession.slug}`,
        tag: `confession-${rem.confession.id}`,
        dueInstant,
      });
    }
  }

  private async collectScriptureCandidates(
    lagosDateStr: string,
    now: Date,
    candidates: TickCandidate[],
  ): Promise<void> {
    const todayDate = new Date(`${lagosDateStr}T00:00:00.000Z`);

    const scriptures = await this.prisma.scripture.findMany({
      where: {
        status: ScriptureStatus.PUBLISHED,
        notifyMembers: true,
        notifiedAt: null,
        startsOn: { lte: todayDate },
      },
    });

    for (const sc of scriptures) {
      const startsOnStr = sc.startsOn.toISOString().slice(0, 10);
      const daysAgo = diffDays(lagosDateStr, startsOnStr);

      // Edge case: if published late (startsOn > 2 days ago), do not send; set notifiedAt silently
      if (daysAgo > 2) {
        await this.prisma.scripture.update({
          where: { id: sc.id },
          data: { notifiedAt: now },
        });
        continue;
      }

      // Retrieve church scripture send time (default 07:00)
      const settings = await this.prisma.notificationSettings.findUnique({
        where: { churchId: sc.churchId },
      });
      const sendTime = settings?.scriptureSendTime || '07:00';
      const dueInstant = lagosTimeToUtc(startsOnStr, sendTime);

      const kindTitle =
        sc.kind === 'WEEK' ? 'Scripture of the Week' : 'Scripture of the Year';
      const excerpt = stripMarkdownAndTruncate(sc.text, 120);

      candidates.push({
        churchId: sc.churchId,
        key: `scripture:${sc.id}`,
        topic: 'scriptures',
        title: kindTitle,
        body: `${sc.reference} — ${excerpt}`,
        url: '/',
        tag: `scripture-${sc.kind.toLowerCase()}`,
        dueInstant,
        afterSend: async () => {
          await this.prisma.scripture.update({
            where: { id: sc.id },
            data: { notifiedAt: new Date() },
          });
        },
      });
    }
  }

  private async collectEncouragementCandidates(
    lagosDateStr: string,
    lagosDayOfWeek: number,
    candidates: TickCandidate[],
  ): Promise<void> {
    const settingsList = await this.prisma.notificationSettings.findMany();

    for (const settings of settingsList) {
      const slots = Array.isArray(settings.encouragementSlots)
        ? (settings.encouragementSlots as Array<{
            day: number;
            time: string;
          }>)
        : [];

      const todaySlots = slots.filter((s) => s.day === lagosDayOfWeek);

      for (const slot of todaySlots) {
        // Among isActive messages, take the one with the oldest lastSentAt (never-sent first)
        const messages = await this.prisma.encouragementMessage.findMany({
          where: {
            churchId: settings.churchId,
            isActive: true,
          },
          orderBy: [
            { lastSentAt: { sort: 'asc', nulls: 'first' } },
            { createdAt: 'asc' },
          ],
          take: 1,
        });

        if (messages.length === 0) {
          // With none active, skip the slot and do not log it
          continue;
        }

        const message = messages[0];
        const dueInstant = lagosTimeToUtc(lagosDateStr, slot.time);
        const body = message.reference
          ? `${message.text} — ${message.reference}`
          : message.text;

        candidates.push({
          churchId: settings.churchId,
          key: `encouragement:${lagosDateStr}:${slot.time}`,
          topic: 'encouragement',
          title: 'A word for you',
          body,
          url: '/',
          tag: 'encouragement',
          dueInstant,
          afterSend: async () => {
            await this.prisma.encouragementMessage.update({
              where: { id: message.id },
              data: { lastSentAt: new Date() },
            });
          },
        });
      }
    }
  }
}
