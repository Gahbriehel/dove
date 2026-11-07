import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/notification-settings.dto';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get settings for the church, creating them with defaults if they don't exist yet.
   */
  async getSettings(churchId: string) {
    const existing = await this.prisma.notificationSettings.findUnique({
      where: { churchId },
    });

    if (existing) {
      return {
        id: existing.id,
        churchId: existing.churchId,
        scriptureSendTime: existing.scriptureSendTime,
        encouragementSlots: Array.isArray(existing.encouragementSlots)
          ? existing.encouragementSlots
          : [],
        updatedAt: existing.updatedAt,
      };
    }

    const created = await this.prisma.notificationSettings.create({
      data: {
        churchId,
        scriptureSendTime: '07:00',
        encouragementSlots: [],
      },
    });

    return {
      id: created.id,
      churchId: created.churchId,
      scriptureSendTime: created.scriptureSendTime,
      encouragementSlots: [],
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Update notification settings for the church.
   */
  async updateSettings(churchId: string, dto: UpdateNotificationSettingsDto) {
    const current = await this.getSettings(churchId);

    const scriptureSendTime =
      dto.scriptureSendTime ?? current.scriptureSendTime;
    const encouragementSlots =
      dto.encouragementSlots ?? current.encouragementSlots;

    const jsonSlots = encouragementSlots as unknown as Prisma.InputJsonValue;

    const updated = await this.prisma.notificationSettings.upsert({
      where: { churchId },
      create: {
        churchId,
        scriptureSendTime,
        encouragementSlots: jsonSlots,
      },
      update: {
        scriptureSendTime,
        encouragementSlots: jsonSlots,
      },
    });

    return {
      id: updated.id,
      churchId: updated.churchId,
      scriptureSendTime: updated.scriptureSendTime,
      encouragementSlots: Array.isArray(updated.encouragementSlots)
        ? updated.encouragementSlots
        : [],
      updatedAt: updated.updatedAt,
    };
  }
}
