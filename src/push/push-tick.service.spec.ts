/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConfessionStatus,
  ScriptureKind,
  ScriptureStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { PushTickService } from './push-tick.service';
import { PushService } from './push.service';

describe('PushTickService', () => {
  let service: PushTickService;
  let prismaMock: {
    notificationLog: {
      create: jest.Mock;
      update: jest.Mock;
    };
    pushSubscription: {
      findMany: jest.Mock;
    };
    nightPrayer: {
      findMany: jest.Mock;
    };
    confessionReminder: {
      findMany: jest.Mock;
    };
    scripture: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
    notificationSettings: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
    };
    encouragementMessage: {
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let pushServiceMock: {
    sendToSubscription: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = {
      notificationLog: {
        create: jest.fn(),
        update: jest.fn(),
      },
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      nightPrayer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      confessionReminder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      scripture: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      notificationSettings: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      encouragementMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'push.cronSecret') return 'super-secret-cron-token-123';
        return undefined;
      }),
    };

    pushServiceMock = {
      sendToSubscription: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushTickService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: PushService, useValue: pushServiceMock },
      ],
    }).compile();

    service = module.get<PushTickService>(PushTickService);
  });

  describe('verifyCronSecret', () => {
    it('accepts correct secret in constant time', () => {
      expect(() =>
        service.verifyCronSecret('Bearer super-secret-cron-token-123'),
      ).not.toThrow();
    });

    it('rejects missing header with 401', () => {
      expect(() => service.verifyCronSecret(undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects wrong secret with 401', () => {
      expect(() =>
        service.verifyCronSecret('Bearer wrong-secret-token-456'),
      ).toThrow(UnauthorizedException);
    });

    it('rejects malformed header without Bearer prefix', () => {
      expect(() =>
        service.verifyCronSecret('super-secret-cron-token-123'),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('Claiming idempotency', () => {
    it('claims a new key and skips duplicate key if already claimed (P2002)', async () => {
      // 2026-11-08 22:00 Lagos = 21:00 UTC
      const now = new Date('2026-11-08T21:02:00.000Z');

      prismaMock.nightPrayer.findMany.mockResolvedValue([
        {
          id: 'prayer-1',
          churchId: 'church-1',
          title: 'Night Prayer',
          timeOfDay: '22:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          reminderOffsetsMin: [],
          exceptions: [],
        },
      ]);

      // First tick creates notification log successfully
      prismaMock.notificationLog.create.mockResolvedValueOnce({
        id: 'log-1',
        key: 'night-prayer:2026-11-08:0',
      });

      const result1 = await service.processTick(now);
      expect(result1.claimed).toEqual(['night-prayer:2026-11-08:0']);

      // Concurrent tick fails with Prisma unique constraint P2002
      prismaMock.notificationLog.create.mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`key`)',
      });

      const result2 = await service.processTick(now);
      expect(result2.claimed).toEqual([]); // Skipped!
    });
  });

  describe('10 minute window', () => {
    it('does not send an occurrence due 11 minutes ago', async () => {
      // Prayer at 22:00 Lagos = 21:00 UTC
      // Now is 21:11:00 UTC (11 minutes past due)
      const now = new Date('2026-11-08T21:11:00.000Z');

      prismaMock.nightPrayer.findMany.mockResolvedValue([
        {
          id: 'prayer-1',
          churchId: 'church-1',
          title: 'Night Prayer',
          timeOfDay: '22:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          reminderOffsetsMin: [],
          exceptions: [],
        },
      ]);

      const result = await service.processTick(now);
      expect(result.claimed).toEqual([]);
      expect(prismaMock.notificationLog.create).not.toHaveBeenCalled();
    });

    it('sends an occurrence due 5 minutes ago', async () => {
      // Prayer at 22:00 Lagos = 21:00 UTC
      // Now is 21:05:00 UTC (5 minutes past due)
      const now = new Date('2026-11-08T21:05:00.000Z');

      prismaMock.nightPrayer.findMany.mockResolvedValue([
        {
          id: 'prayer-1',
          churchId: 'church-1',
          title: 'Night Prayer',
          timeOfDay: '22:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          reminderOffsetsMin: [],
          exceptions: [],
        },
      ]);
      prismaMock.notificationLog.create.mockResolvedValue({});

      const result = await service.processTick(now);
      expect(result.claimed).toEqual(['night-prayer:2026-11-08:0']);
      expect(prismaMock.notificationLog.create).toHaveBeenCalled();
    });
  });

  describe('Scripture notifications', () => {
    it('marks a scripture started 3 days ago as notified without sending', async () => {
      // Today is 2026-11-10 07:02 Lagos = 06:02 UTC
      const now = new Date('2026-11-10T06:02:00.000Z');

      prismaMock.scripture.findMany.mockResolvedValue([
        {
          id: 'sc-old',
          churchId: 'church-1',
          kind: ScriptureKind.WEEK,
          text: 'Be strong and courageous',
          reference: 'Joshua 1:9',
          startsOn: new Date('2026-11-07T00:00:00.000Z'), // 3 days ago
          status: ScriptureStatus.PUBLISHED,
          notifyMembers: true,
          notifiedAt: null,
        },
      ]);

      const result = await service.processTick(now);
      // Not claimed / not sent
      expect(result.claimed).not.toContain('scripture:sc-old');
      // Silently marked notified
      expect(prismaMock.scripture.update).toHaveBeenCalledWith({
        where: { id: 'sc-old' },
        data: { notifiedAt: now },
      });
    });

    it('does not send when notifyMembers is false (filtered by query)', async () => {
      // The query includes notifyMembers: true, so Prisma returns empty
      prismaMock.scripture.findMany.mockResolvedValue([]);

      const now = new Date('2026-11-08T06:01:00.000Z');
      const result = await service.processTick(now);
      expect(result.claimed).toEqual([]);
      expect(prismaMock.scripture.update).not.toHaveBeenCalled();
    });
  });

  describe('Encouragement rotation order', () => {
    it('picks never-sent message first, then oldest lastSentAt', async () => {
      // Lagos 2026-11-08 is Sunday (day 0)
      // Slot at 12:30 Lagos = 11:30 UTC
      const now = new Date('2026-11-08T11:31:00.000Z');

      prismaMock.notificationSettings.findMany.mockResolvedValue([
        {
          churchId: 'church-1',
          encouragementSlots: [{ day: 0, time: '12:30' }],
        },
      ]);

      prismaMock.encouragementMessage.findMany.mockResolvedValue([
        {
          id: 'msg-never-sent',
          churchId: 'church-1',
          text: 'Peace be with you',
          reference: 'John 14:27',
          isActive: true,
          lastSentAt: null,
        },
      ]);
      prismaMock.notificationLog.create.mockResolvedValue({});

      const result = await service.processTick(now);
      expect(result.claimed).toEqual(['encouragement:2026-11-08:12:30']);

      expect(prismaMock.encouragementMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { churchId: 'church-1', isActive: true },
          orderBy: [
            { lastSentAt: { sort: 'asc', nulls: 'first' } },
            { createdAt: 'asc' },
          ],
        }),
      );
    });

    it('skips slot and does not log when no active encouragement messages exist', async () => {
      const now = new Date('2026-11-08T11:31:00.000Z');

      prismaMock.notificationSettings.findMany.mockResolvedValue([
        {
          churchId: 'church-1',
          encouragementSlots: [{ day: 0, time: '12:30' }],
        },
      ]);

      // No active messages
      prismaMock.encouragementMessage.findMany.mockResolvedValue([]);

      const result = await service.processTick(now);
      expect(result.claimed).toEqual([]);
      expect(prismaMock.notificationLog.create).not.toHaveBeenCalled();
    });
  });

  describe('Confession reminders day and date filtering', () => {
    it('sends confession reminder when matching day and within date range', async () => {
      // 2026-11-08 (Sunday, day 0) at 06:31 Lagos = 05:31 UTC
      const now = new Date('2026-11-08T05:31:00.000Z');

      prismaMock.confessionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-1',
          confessionId: 'conf-1',
          timeOfDay: '06:30',
          daysOfWeek: [0, 1, 2], // Sunday included
          startsOn: new Date('2026-11-01T00:00:00.000Z'),
          endsOn: new Date('2026-11-30T00:00:00.000Z'),
          message: 'Declare your blessings',
          confession: {
            id: 'conf-1',
            churchId: 'church-1',
            title: 'Daily Confession',
            slug: 'daily-confession',
            body: 'I am blessed and highly favoured',
            scriptureRef: 'Deut 28',
            status: ConfessionStatus.PUBLISHED,
          },
        },
      ]);
      prismaMock.notificationLog.create.mockResolvedValue({});

      const result = await service.processTick(now);
      expect(result.claimed).toEqual(['confession:rem-1:2026-11-08']);
      expect(prismaMock.notificationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'confession:rem-1:2026-11-08',
          title: 'Daily Confession',
          body: 'Declare your blessings',
          url: '/confessions/daily-confession',
        }),
      });
    });

    it('skips confession reminder when day of week does not match', async () => {
      // 2026-11-08 is Sunday (0)
      const now = new Date('2026-11-08T05:31:00.000Z');

      prismaMock.confessionReminder.findMany.mockResolvedValue([
        {
          id: 'rem-weekdays',
          confessionId: 'conf-1',
          timeOfDay: '06:30',
          daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday only
          startsOn: null,
          endsOn: null,
          message: null,
          confession: {
            id: 'conf-1',
            churchId: 'church-1',
            title: 'Workday Confession',
            slug: 'workday-confession',
            body: 'Grace at work',
            scriptureRef: null,
            status: ConfessionStatus.PUBLISHED,
          },
        },
      ]);

      const result = await service.processTick(now);
      expect(result.claimed).toEqual([]);
    });
  });
});
