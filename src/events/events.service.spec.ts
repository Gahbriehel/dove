import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

describe('EventsService', () => {
  let service: EventsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    event: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    registration: {
      count: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest.fn(),
      },
      event: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      registration: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe('create', () => {
    it('should create an event with capacity', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.event.create.mockResolvedValue({
        id: 'event-1',
        title: 'Youth Conference',
        capacity: 100,
        startDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-09-01T18:00:00Z'),
        churchId: 'church-1',
      });

      const result = await service.create(
        {
          title: 'Youth Conference',
          capacity: 100,
          startDate: '2026-09-01T10:00:00Z',
          endDate: '2026-09-01T18:00:00Z',
        },
        'church-1',
      );

      expect(result.capacity).toEqual(100);
      expect(prismaMock.event.create).toHaveBeenCalledWith({
        data: {
          title: 'Youth Conference',
          capacity: 100,
          startDate: new Date('2026-09-01T10:00:00Z'),
          endDate: new Date('2026-09-01T18:00:00Z'),
          churchId: 'church-1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return events formatted with checkedInCount, registeredCount, games, teams without _count', async () => {
      prismaMock.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'Worship Night',
          church: { id: 'church-1', name: 'Grace Church', slug: 'grace' },
          registrations: [
            { status: RegistrationStatus.CHECKED_IN },
            { status: RegistrationStatus.CONFIRMED },
            { status: RegistrationStatus.CHECKED_IN },
          ],
          _count: {
            registrations: 3,
            teams: 2,
            games: 4,
          },
        },
      ]);
      prismaMock.event.count.mockResolvedValue(1);

      const result = await service.findAll({}, 'church-1');

      expect(result.items[0]).toEqual({
        id: 'event-1',
        title: 'Worship Night',
        church: { id: 'church-1', name: 'Grace Church', slug: 'grace' },
        checkedInCount: 2,
        registeredCount: 3,
        games: 4,
        teams: 2,
      });
      expect(result.items[0]).not.toHaveProperty('_count');
    });
  });

  describe('findOne', () => {
    it('should return single event with checkedInCount and registeredCount without _count', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        title: 'Leadership Summit',
        church: { id: 'church-1', name: 'Grace Church', slug: 'grace' },
        teams: [{ id: 'team-1' }],
        games: [{ id: 'game-1' }],
        registrations: [{ status: RegistrationStatus.CHECKED_IN }],
        _count: {
          registrations: 1,
          teams: 1,
          games: 1,
        },
      });

      const result = await service.findOne('event-1', 'church-1');

      expect(result.checkedInCount).toEqual(1);
      expect(result.registeredCount).toEqual(1);
      expect(result).not.toHaveProperty('_count');
    });
  });

  describe('update', () => {
    it('should update capacity successfully if capacity >= active registrations', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        churchId: 'church-1',
        startDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-09-01T18:00:00Z'),
        capacity: 100,
      });
      prismaMock.registration.count.mockResolvedValue(30);
      prismaMock.event.update.mockResolvedValue({
        id: 'event-1',
        capacity: 50,
      });

      const result = await service.update(
        'event-1',
        { capacity: 50 },
        'church-1',
      );

      expect(result.capacity).toEqual(50);
      expect(prismaMock.registration.count).toHaveBeenCalledWith({
        where: {
          eventId: 'event-1',
          status: { not: RegistrationStatus.CANCELLED },
        },
      });
    });

    it('should throw BadRequestException if new capacity is lower than active registrations', async () => {
      prismaMock.event.findFirst.mockResolvedValue({
        id: 'event-1',
        churchId: 'church-1',
        startDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-09-01T18:00:00Z'),
        capacity: 100,
      });
      prismaMock.registration.count.mockResolvedValue(60);

      await expect(
        service.update('event-1', { capacity: 50 }, 'church-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
