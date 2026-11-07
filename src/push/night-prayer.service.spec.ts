import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NightPrayerService } from './night-prayer.service';

describe('NightPrayerService', () => {
  let service: NightPrayerService;
  let prismaMock: {
    nightPrayer: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
    nightPrayerException: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      nightPrayer: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      nightPrayerException: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NightPrayerService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<NightPrayerService>(NightPrayerService);
  });

  describe('getNextNightPrayer statuses', () => {
    const basePrayer = {
      id: 'prayer-1',
      churchId: 'church-1',
      title: 'Night Prayer',
      description: 'Ending the day in prayer',
      imageUrl: '/public/uploads/night-prayer.jpg',
      meetUrl: 'https://meet.google.com/abc-defg-hij',
      timeOfDay: '22:00', // 22:00 Lagos = 21:00 UTC
      durationMin: 60,
      joinOpensMinBefore: 10,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // all seven days
      reminderOffsetsMin: [60],
      isActive: true,
      exceptions: [],
    };

    it('returns inactive status when no config exists', async () => {
      prismaMock.nightPrayer.findUnique.mockResolvedValue(null);

      const result = await service.getNextNightPrayer('church-1');
      expect(result.status).toBe('inactive');
      expect(result.title).toBeNull();
      expect(result.meetUrl).toBeNull();
      expect(result.startsAt).toBeNull();
    });

    it('returns inactive status when isActive is false', async () => {
      prismaMock.nightPrayer.findUnique.mockResolvedValue({
        ...basePrayer,
        isActive: false,
      });

      const result = await service.getNextNightPrayer('church-1');
      expect(result.status).toBe('inactive');
      expect(result.title).toBeNull();
    });

    it('returns upcoming status when before joinOpensAt', async () => {
      // 2026-11-08 20:00 Lagos = 19:00 UTC
      const now = new Date('2026-11-08T19:00:00.000Z');
      prismaMock.nightPrayer.findUnique.mockResolvedValue(basePrayer);

      const result = await service.getNextNightPrayer('church-1', now);
      expect(result.status).toBe('upcoming');
      expect(result.startsAt).toBe('2026-11-08T21:00:00.000Z'); // 22:00 Lagos
      expect(result.joinOpensAt).toBe('2026-11-08T20:50:00.000Z'); // 21:50 Lagos
      expect(result.endsAt).toBe('2026-11-08T22:00:00.000Z'); // 23:00 Lagos
      expect(result.meetUrl).toBe('https://meet.google.com/abc-defg-hij');
      expect(result.note).toBeNull();
    });

    it('returns live status when now is between joinOpensAt and endsAt', async () => {
      // 2026-11-08 21:55 Lagos = 20:55 UTC (between joinOpensAt 20:50 UTC and endsAt 22:00 UTC)
      const now = new Date('2026-11-08T20:55:00.000Z');
      prismaMock.nightPrayer.findUnique.mockResolvedValue(basePrayer);

      const result = await service.getNextNightPrayer('church-1', now);
      expect(result.status).toBe('live');
      expect(result.startsAt).toBe('2026-11-08T21:00:00.000Z');
      expect(result.meetUrl).toBe('https://meet.google.com/abc-defg-hij');
    });

    it('returns ended status after today endsAt, describing tomorrow occurrence', async () => {
      // 2026-11-08 23:15 Lagos = 22:15 UTC (endsAt was 22:00 UTC)
      const now = new Date('2026-11-08T22:15:00.000Z');
      prismaMock.nightPrayer.findUnique.mockResolvedValue(basePrayer);

      const result = await service.getNextNightPrayer('church-1', now);
      expect(result.status).toBe('ended');
      // Describes tomorrow (Nov 9):
      expect(result.startsAt).toBe('2026-11-09T21:00:00.000Z');
      expect(result.joinOpensAt).toBe('2026-11-09T20:50:00.000Z');
      expect(result.endsAt).toBe('2026-11-09T22:00:00.000Z');
    });

    it('returns cancelled status when an exception cancels the next occurrence', async () => {
      // 2026-11-08 20:00 Lagos
      const now = new Date('2026-11-08T19:00:00.000Z');
      prismaMock.nightPrayer.findUnique.mockResolvedValue({
        ...basePrayer,
        exceptions: [
          {
            id: 'exc-1',
            date: new Date('2026-11-08T00:00:00.000Z'),
            cancelled: true,
            note: 'No prayer tonight, service tomorrow morning',
          },
        ],
      });

      const result = await service.getNextNightPrayer('church-1', now);
      expect(result.status).toBe('cancelled');
      expect(result.note).toBe('No prayer tonight, service tomorrow morning');
      expect(result.startsAt).toBe('2026-11-08T21:00:00.000Z');
    });

    it('handles midnight edge: prayer starting 23:50 is still live at 00:10 next morning', async () => {
      // Prayer starts at 23:50 Lagos (22:50 UTC) on 2026-11-08, 60 min duration -> endsAt 00:50 Lagos (23:50 UTC)
      const latePrayer = {
        ...basePrayer,
        timeOfDay: '23:50',
        durationMin: 60,
        joinOpensMinBefore: 10,
      };
      prismaMock.nightPrayer.findUnique.mockResolvedValue(latePrayer);

      // Now is 00:10 Lagos on 2026-11-09 = 23:10 UTC on 2026-11-08
      const now = new Date('2026-11-08T23:10:00.000Z');

      const result = await service.getNextNightPrayer('church-1', now);
      expect(result.status).toBe('live');
      expect(result.startsAt).toBe('2026-11-08T22:50:00.000Z');
      expect(result.endsAt).toBe('2026-11-08T23:50:00.000Z');
    });
  });

  describe('Admin Night Prayer config & exceptions', () => {
    it('creates or replaces config with default values', async () => {
      prismaMock.nightPrayer.upsert.mockResolvedValue({
        id: 'prayer-1',
        churchId: 'church-1',
        title: 'Night Prayer',
        description: 'Daily prayer',
        imageUrl: null,
        meetUrl: 'https://meet.google.com/abc-defg-hij',
        timeOfDay: '22:00',
        durationMin: 60,
        joinOpensMinBefore: 10,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        reminderOffsetsMin: [60],
        isActive: true,
        updatedById: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.putNightPrayer(
        'church-1',
        {
          title: 'Night Prayer',
          meetUrl: 'https://meet.google.com/abc-defg-hij',
          timeOfDay: '22:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        },
        'user-1',
      );

      expect(result.title).toBe('Night Prayer');
      expect(result.durationMin).toBe(60);
      expect(result.joinOpensMinBefore).toBe(10);
      expect(prismaMock.nightPrayer.upsert).toHaveBeenCalled();
    });

    it('rejects exception creation for dates in the past', async () => {
      prismaMock.nightPrayer.findUnique.mockResolvedValue({
        id: 'prayer-1',
        churchId: 'church-1',
      });

      // Yesterday or 2020-01-01 is in the past
      await expect(
        service.createException('church-1', {
          date: '2020-01-01',
          cancelled: true,
          note: 'Old',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('removes exception by id', async () => {
      prismaMock.nightPrayerException.findUnique.mockResolvedValue({
        id: 'exc-1',
        nightPrayer: { churchId: 'church-1' },
      });
      prismaMock.nightPrayerException.delete.mockResolvedValue({});

      const result = await service.removeException('exc-1', 'church-1');
      expect(result.message).toBe('Exception deleted successfully');
      expect(prismaMock.nightPrayerException.delete).toHaveBeenCalledWith({
        where: { id: 'exc-1' },
      });
    });

    it('throws NotFoundException when removing non-existent exception', async () => {
      prismaMock.nightPrayerException.findUnique.mockResolvedValue(null);

      await expect(
        service.removeException('non-existent', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
