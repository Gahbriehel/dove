import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNightPrayerExceptionDto } from './dto/night-prayer-exception.dto';
import { PutNightPrayerDto } from './dto/night-prayer.dto';
import {
  addDaysToDateStr,
  getLagosTimeParts,
  getTodayInLagos,
  lagosTimeToUtc,
} from './utils/push-time.util';

export type NightPrayerStatus =
  'upcoming' | 'live' | 'ended' | 'cancelled' | 'inactive';

export interface NextNightPrayerResponse {
  status: NightPrayerStatus;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  meetUrl: string | null;
  startsAt: string | null;
  joinOpensAt: string | null;
  endsAt: string | null;
  note: string | null;
  now: string;
}

@Injectable()
export class NightPrayerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the Night Prayer configuration for a church.
   */
  async getNightPrayer(churchId: string) {
    const nightPrayer = await this.prisma.nightPrayer.findUnique({
      where: { churchId },
    });

    if (!nightPrayer) {
      return null;
    }

    return {
      id: nightPrayer.id,
      churchId: nightPrayer.churchId,
      title: nightPrayer.title,
      description: nightPrayer.description,
      imageUrl: nightPrayer.imageUrl,
      meetUrl: nightPrayer.meetUrl,
      timeOfDay: nightPrayer.timeOfDay,
      durationMin: nightPrayer.durationMin,
      joinOpensMinBefore: nightPrayer.joinOpensMinBefore,
      daysOfWeek: Array.isArray(nightPrayer.daysOfWeek)
        ? nightPrayer.daysOfWeek
        : [],
      reminderOffsetsMin: Array.isArray(nightPrayer.reminderOffsetsMin)
        ? nightPrayer.reminderOffsetsMin
        : [],
      isActive: nightPrayer.isActive,
      updatedById: nightPrayer.updatedById,
      createdAt: nightPrayer.createdAt,
      updatedAt: nightPrayer.updatedAt,
    };
  }

  /**
   * Create or update the Night Prayer configuration for a church.
   */
  async putNightPrayer(
    churchId: string,
    dto: PutNightPrayerDto,
    userId?: string,
  ) {
    const durationMin = dto.durationMin ?? 60;
    const joinOpensMinBefore = dto.joinOpensMinBefore ?? 10;
    const reminderOffsetsMin = dto.reminderOffsetsMin ?? [];
    const isActive = dto.isActive !== undefined ? dto.isActive : true;

    const saved = await this.prisma.nightPrayer.upsert({
      where: { churchId },
      create: {
        churchId,
        title: dto.title,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        meetUrl: dto.meetUrl,
        timeOfDay: dto.timeOfDay,
        durationMin,
        joinOpensMinBefore,
        daysOfWeek: dto.daysOfWeek,
        reminderOffsetsMin,
        isActive,
        updatedById: userId ?? null,
      },
      update: {
        title: dto.title,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        meetUrl: dto.meetUrl,
        timeOfDay: dto.timeOfDay,
        durationMin,
        joinOpensMinBefore,
        daysOfWeek: dto.daysOfWeek,
        reminderOffsetsMin,
        isActive,
        updatedById: userId ?? null,
      },
    });

    return {
      id: saved.id,
      churchId: saved.churchId,
      title: saved.title,
      description: saved.description,
      imageUrl: saved.imageUrl,
      meetUrl: saved.meetUrl,
      timeOfDay: saved.timeOfDay,
      durationMin: saved.durationMin,
      joinOpensMinBefore: saved.joinOpensMinBefore,
      daysOfWeek: Array.isArray(saved.daysOfWeek) ? saved.daysOfWeek : [],
      reminderOffsetsMin: Array.isArray(saved.reminderOffsetsMin)
        ? saved.reminderOffsetsMin
        : [],
      isActive: saved.isActive,
      updatedById: saved.updatedById,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * List exceptions for a church's night prayer.
   */
  async getExceptions(churchId: string) {
    const nightPrayer = await this.prisma.nightPrayer.findUnique({
      where: { churchId },
    });

    if (!nightPrayer) {
      return [];
    }

    const exceptions = await this.prisma.nightPrayerException.findMany({
      where: { nightPrayerId: nightPrayer.id },
      orderBy: { date: 'asc' },
    });

    return exceptions.map((e) => ({
      id: e.id,
      nightPrayerId: e.nightPrayerId,
      date: e.date.toISOString().slice(0, 10),
      cancelled: e.cancelled,
      note: e.note,
      createdAt: e.createdAt,
    }));
  }

  /**
   * Create or update an exception for a specific date.
   * Dates in the past are rejected.
   */
  async createException(churchId: string, dto: CreateNightPrayerExceptionDto) {
    const nightPrayer = await this.prisma.nightPrayer.findUnique({
      where: { churchId },
    });

    if (!nightPrayer) {
      throw new NotFoundException('Night prayer configuration not found');
    }

    const todayInLagos = getTodayInLagos();
    if (dto.date < todayInLagos) {
      throw new BadRequestException(
        'Cannot create exceptions for dates in the past',
      );
    }

    const dateObj = new Date(`${dto.date}T00:00:00.000Z`);
    const cancelled = dto.cancelled !== undefined ? dto.cancelled : true;
    const note = dto.note ?? null;

    const saved = await this.prisma.nightPrayerException.upsert({
      where: {
        nightPrayerId_date: {
          nightPrayerId: nightPrayer.id,
          date: dateObj,
        },
      },
      create: {
        nightPrayerId: nightPrayer.id,
        date: dateObj,
        cancelled,
        note,
      },
      update: {
        cancelled,
        note,
      },
    });

    return {
      id: saved.id,
      nightPrayerId: saved.nightPrayerId,
      date: saved.date.toISOString().slice(0, 10),
      cancelled: saved.cancelled,
      note: saved.note,
      createdAt: saved.createdAt,
    };
  }

  /**
   * Remove an exception by ID.
   */
  async removeException(id: string, churchId: string) {
    const exception = await this.prisma.nightPrayerException.findUnique({
      where: { id },
      include: { nightPrayer: true },
    });

    if (!exception || exception.nightPrayer.churchId !== churchId) {
      throw new NotFoundException('Exception not found');
    }

    await this.prisma.nightPrayerException.delete({
      where: { id },
    });

    return { message: 'Exception deleted successfully' };
  }

  /**
   * Calculate what the home card shows.
   * Evaluated in Africa/Lagos time.
   */
  async getNextNightPrayer(
    churchId: string,
    now: Date = new Date(),
  ): Promise<NextNightPrayerResponse> {
    const nightPrayer = await this.prisma.nightPrayer.findUnique({
      where: { churchId },
      include: {
        exceptions: true,
      },
    });

    const nowIso = now.toISOString();

    if (!nightPrayer || !nightPrayer.isActive) {
      return {
        status: 'inactive',
        title: null,
        description: null,
        imageUrl: null,
        meetUrl: null,
        startsAt: null,
        joinOpensAt: null,
        endsAt: null,
        note: null,
        now: nowIso,
      };
    }

    const daysOfWeek: number[] = Array.isArray(nightPrayer.daysOfWeek)
      ? (nightPrayer.daysOfWeek as unknown as number[])
      : [];

    if (daysOfWeek.length === 0) {
      return {
        status: 'inactive',
        title: null,
        description: null,
        imageUrl: null,
        meetUrl: null,
        startsAt: null,
        joinOpensAt: null,
        endsAt: null,
        note: null,
        now: nowIso,
      };
    }

    const exceptionsMap = new Map<
      string,
      { cancelled: boolean; note: string | null }
    >();
    for (const exc of nightPrayer.exceptions) {
      const dStr = exc.date.toISOString().slice(0, 10);
      exceptionsMap.set(dStr, { cancelled: exc.cancelled, note: exc.note });
    }

    const { dateStr: todayStr } = getLagosTimeParts(now);

    // Check if today had a scheduled prayer that already ended
    let todayEnded = false;
    // Get the exact weekday of today in Lagos
    const [tY, tM, tD] = todayStr.split('-').map(Number);
    const lagosTodayDayOfWeek = new Date(
      Date.UTC(tY, tM - 1, tD, 12, 0),
    ).getUTCDay();

    if (daysOfWeek.includes(lagosTodayDayOfWeek)) {
      const todayStartsAt = lagosTimeToUtc(todayStr, nightPrayer.timeOfDay);
      const todayEndsAt = new Date(
        todayStartsAt.getTime() + nightPrayer.durationMin * 60_000,
      );
      if (todayEndsAt.getTime() <= now.getTime()) {
        todayEnded = true;
      }
    }

    // Search for first occurrence whose endsAt is still in the future
    // Check day -1 (in case yesterday's late session runs past midnight into today)
    // up to 14 days ahead
    for (let dayOffset = -1; dayOffset <= 14; dayOffset++) {
      const candidateDateStr = addDaysToDateStr(todayStr, dayOffset);
      const [y, m, d] = candidateDateStr.split('-').map(Number);
      const weekday = new Date(Date.UTC(y, m - 1, d, 12, 0)).getUTCDay();

      if (!daysOfWeek.includes(weekday)) {
        continue;
      }

      const startsAt = lagosTimeToUtc(candidateDateStr, nightPrayer.timeOfDay);
      const joinOpensAt = new Date(
        startsAt.getTime() - nightPrayer.joinOpensMinBefore * 60_000,
      );
      const endsAt = new Date(
        startsAt.getTime() + nightPrayer.durationMin * 60_000,
      );

      if (endsAt.getTime() <= now.getTime()) {
        // Occurrence has already ended
        continue;
      }

      // Found the first occurrence whose endsAt is in the future!
      const exc = exceptionsMap.get(candidateDateStr);
      let status: NightPrayerStatus;
      const note: string | null = exc?.note ?? null;

      if (exc?.cancelled) {
        status = 'cancelled';
      } else if (todayEnded && candidateDateStr > todayStr) {
        status = 'ended';
      } else if (
        now.getTime() >= joinOpensAt.getTime() &&
        now.getTime() < endsAt.getTime()
      ) {
        status = 'live';
      } else {
        status = 'upcoming';
      }

      return {
        status,
        title: nightPrayer.title,
        description: nightPrayer.description ?? null,
        imageUrl: nightPrayer.imageUrl ?? null,
        meetUrl: nightPrayer.meetUrl,
        startsAt: startsAt.toISOString(),
        joinOpensAt: joinOpensAt.toISOString(),
        endsAt: endsAt.toISOString(),
        note,
        now: nowIso,
      };
    }

    return {
      status: 'inactive',
      title: null,
      description: null,
      imageUrl: null,
      meetUrl: null,
      startsAt: null,
      joinOpensAt: null,
      endsAt: null,
      note: null,
      now: nowIso,
    };
  }
}
