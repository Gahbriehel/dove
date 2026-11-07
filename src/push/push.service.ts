import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PushSubscription } from '@prisma/client';
import type { Request } from 'express';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { MemberJwtPayload } from '../profile/guards/member-auth.guard';
import { MemberSessionService } from '../profile/member-session.service';
import { EndpointDto } from './dto/endpoint.dto';
import { ALLOWED_TOPICS, PushTopic, SubscribeDto } from './dto/subscribe.dto';
import { UpdateTopicsDto } from './dto/topics.dto';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
  topic: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private testSelfRateLimits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly memberSessionService: MemberSessionService,
  ) {
    const vapidSubject =
      this.configService.get<string>('push.vapidSubject') ||
      'mailto:info@abwog.org';
    const vapidPublicKey = this.configService.get<string>(
      'push.vapidPublicKey',
    );
    const vapidPrivateKey = this.configService.get<string>(
      'push.vapidPrivateKey',
    );

    if (vapidPublicKey && vapidPrivateKey) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } else {
      this.logger.warn(
        'VAPID keys not fully configured. Push notifications will not send.',
      );
    }
  }

  /**
   * Register or refresh a device's push subscription.
   */
  async subscribe(
    dto: SubscribeDto,
    req?: Request,
  ): Promise<{ subscribed: boolean; topics: PushTopic[] }> {
    const churchId = await this.prisma.getDefaultChurchId();
    const endpoint = dto.subscription.endpoint;
    const p256dh = dto.subscription.keys.p256dh;
    const auth = dto.subscription.keys.auth;
    const topics: PushTopic[] =
      dto.topics && dto.topics.length > 0 ? dto.topics : [...ALLOWED_TOPICS];

    // Resolve personId from member session if present
    let personId: string | null = null;
    const candidateToken =
      dto.memberToken ||
      (req?.headers?.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    if (candidateToken) {
      try {
        const secret = this.configService.get<string>('jwt.secret');
        const payload = await this.jwtService.verifyAsync<MemberJwtPayload>(
          candidateToken,
          { secret },
        );
        if (
          (payload.type?.toUpperCase() === 'MEMBER' ||
            payload.aud === 'dove:member') &&
          payload.sub &&
          !this.memberSessionService.isRevoked(payload.jti, candidateToken)
        ) {
          personId = payload.sub;
        }
      } catch {
        // Missing, expired or invalid member token is ignored on anonymous subscribe
        personId = null;
      }
    }

    const rawUserAgent = req?.headers?.['user-agent'];
    const userAgent =
      typeof rawUserAgent === 'string' ? rawUserAgent.slice(0, 255) : null;

    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        churchId,
        endpoint,
        p256dh,
        auth,
        topics,
        personId,
        userAgent,
        failureCount: 0,
        lastSeenAt: new Date(),
      },
      update: {
        churchId,
        p256dh,
        auth,
        topics,
        personId: personId !== null ? personId : undefined,
        userAgent: userAgent ?? undefined,
        failureCount: 0,
        lastSeenAt: new Date(),
      },
    });

    return {
      subscribed: true,
      topics,
    };
  }

  /**
   * Idempotently delete a device subscription.
   */
  async unsubscribe(dto: EndpointDto): Promise<{ unsubscribed: boolean }> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint: dto.endpoint },
    });
    return { unsubscribed: true };
  }

  /**
   * Update topic preferences for a device.
   */
  async updateTopics(
    dto: UpdateTopicsDto,
  ): Promise<{ updated: boolean; topics: PushTopic[] }> {
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
    });

    if (!existing) {
      throw new NotFoundException('Subscription not found');
    }

    await this.prisma.pushSubscription.update({
      where: { endpoint: dto.endpoint },
      data: {
        topics: dto.topics,
        lastSeenAt: new Date(),
      },
    });

    return {
      updated: true,
      topics: dto.topics,
    };
  }

  /**
   * Send a test push notification to the calling device only.
   * Rate limited to at most 3 per hour per endpoint.
   */
  async testSelf(dto: EndpointDto): Promise<{ sent: boolean }> {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const timestamps = (this.testSelfRateLimits.get(dto.endpoint) || []).filter(
      (ts) => ts > oneHourAgo,
    );

    if (timestamps.length >= 3) {
      throw new HttpException(
        'Too many test requests. Maximum 3 per hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const subscription = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    timestamps.push(now);
    this.testSelfRateLimits.set(dto.endpoint, timestamps);

    const payload: PushPayload = {
      title: 'Notifications are on',
      body: 'Notifications are configured properly on this device.',
      url: '/',
      tag: 'test-notification',
      topic: 'night-prayer',
    };

    const sent = await this.sendToSubscription(subscription, payload);
    return { sent };
  }

  /**
   * Send a Web Push notification to a single PushSubscription.
   * Handles 404/410 removal, failure count increment, and threshold (5) removal.
   */
  async sendToSubscription(
    sub: PushSubscription,
    payload: PushPayload,
  ): Promise<boolean> {
    const isNightPrayer = payload.topic === 'night-prayer';
    const isConfessions = payload.topic === 'confessions';

    const ttl = isNightPrayer || isConfessions ? 600 : 86400;
    const urgency = isNightPrayer ? 'high' : 'normal';

    const pushData = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      topic: payload.topic,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        pushData,
        {
          TTL: ttl,
          urgency,
        },
      );

      // On successful delivery, reset failure count if it was non-zero
      if (sub.failureCount > 0) {
        await this.prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { failureCount: 0 },
        });
      }
      return true;
    } catch (err: unknown) {
      const errorObj = err as {
        statusCode?: number;
        status?: number;
        message?: string;
      };
      const statusCode = errorObj.statusCode || errorObj.status;

      if (statusCode === 404 || statusCode === 410) {
        // Subscription is defunct or unregistered
        this.logger.log(
          `Removing defunct push subscription ${sub.id} (status: ${statusCode})`,
        );
        await this.prisma.pushSubscription
          .delete({
            where: { id: sub.id },
          })
          .catch(() => undefined);
      } else {
        const nextFailures = sub.failureCount + 1;
        if (nextFailures >= 5) {
          this.logger.log(
            `Removing push subscription ${sub.id} after ${nextFailures} failures`,
          );
          await this.prisma.pushSubscription
            .delete({
              where: { id: sub.id },
            })
            .catch(() => undefined);
        } else {
          await this.prisma.pushSubscription
            .update({
              where: { id: sub.id },
              data: { failureCount: { increment: 1 } },
            })
            .catch(() => undefined);
        }
      }
      return false;
    }
  }

  /**
   * Retrieve notification log history and current subscriber counts.
   */
  async getLog(churchId: string) {
    const [logs, subscriptions] = await Promise.all([
      this.prisma.notificationLog.findMany({
        where: { churchId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.pushSubscription.findMany({
        where: { churchId },
        select: { topics: true },
      }),
    ]);

    const byTopic: Record<PushTopic, number> = {
      'night-prayer': 0,
      confessions: 0,
      scriptures: 0,
      encouragement: 0,
    };

    for (const sub of subscriptions) {
      const topics = Array.isArray(sub.topics)
        ? (sub.topics as PushTopic[])
        : [];
      for (const t of topics) {
        if (t in byTopic) {
          byTopic[t]++;
        }
      }
    }

    return {
      logs,
      subscribers: {
        total: subscriptions.length,
        byTopic,
      },
    };
  }
}
