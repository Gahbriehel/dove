import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CheckInReason, CheckInStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInsService } from './check-ins.service';

describe('CheckInsService', () => {
  let service: CheckInsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    person: {
      findFirst: jest.Mock;
    };
    user: {
      findFirst: jest.Mock;
    };
    pastoralCheckIn: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      person: {
        findFirst: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
      },
      pastoralCheckIn: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CheckInsService>(CheckInsService);
  });

  describe('create', () => {
    it('should create a scheduled check-in', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
      });
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'user-assigned',
        churchId: 'church-1',
      });
      prismaMock.pastoralCheckIn.create.mockResolvedValue({
        id: 'checkin-1',
        churchId: 'church-1',
        personId: 'person-1',
        createdById: 'user-creator',
        assignedToId: 'user-assigned',
        reason: CheckInReason.ABSENTEEISM,
        status: CheckInStatus.SCHEDULED,
        scheduledFor: new Date('2026-10-25T10:00:00Z'),
        completedAt: null,
        notes: 'Missed service',
      });

      const result = await service.create(
        {
          personId: 'person-1',
          assignedToId: 'user-assigned',
          reason: CheckInReason.ABSENTEEISM,
          scheduledFor: '2026-10-25T10:00:00Z',
          notes: 'Missed service',
        },
        { id: 'user-creator', churchId: 'church-1' },
      );

      expect(result.id).toBe('checkin-1');
      expect(result.status).toBe(CheckInStatus.SCHEDULED);
      expect(prismaMock.pastoralCheckIn.create).toHaveBeenCalledTimes(1);
      const firstCall = prismaMock.pastoralCheckIn.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(firstCall[0].data).toEqual({
        personId: 'person-1',
        churchId: 'church-1',
        createdById: 'user-creator',
        assignedToId: 'user-assigned',
        status: CheckInStatus.SCHEDULED,
        reason: CheckInReason.ABSENTEEISM,
        scheduledFor: new Date('2026-10-25T10:00:00Z'),
        completedAt: null,
        notes: 'Missed service',
      });
    });

    it('should automatically set completedAt when status is COMPLETED and completedAt omitted', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
      });
      prismaMock.pastoralCheckIn.create.mockResolvedValue({
        id: 'checkin-2',
        status: CheckInStatus.COMPLETED,
        completedAt: new Date(),
      });

      const result = await service.create(
        {
          personId: 'person-1',
          status: CheckInStatus.COMPLETED,
          notes: 'Already called',
        },
        { id: 'user-creator', churchId: 'church-1' },
      );

      expect(result.id).toBe('checkin-2');
      expect(prismaMock.pastoralCheckIn.create).toHaveBeenCalledTimes(1);
      const secondCall = prismaMock.pastoralCheckIn.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(secondCall[0].data.status).toBe(CheckInStatus.COMPLETED);
      expect(secondCall[0].data.completedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if person not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { personId: 'missing-person' },
          { id: 'user-creator', churchId: 'church-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if assigned user not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
      });
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { personId: 'person-1', assignedToId: 'missing-user' },
          { id: 'user-creator', churchId: 'church-1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should extract createdById from currentUser.sub (ActiveUserData)', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
      });
      prismaMock.pastoralCheckIn.create.mockResolvedValue({
        id: 'checkin-jwt',
        createdById: 'jwt-sub-id',
      });

      await service.create(
        { personId: 'person-1' },
        { sub: 'jwt-sub-id', churchId: 'church-1' },
      );

      expect(prismaMock.pastoralCheckIn.create).toHaveBeenCalledTimes(1);
      const call = prismaMock.pastoralCheckIn.create.mock.calls[0] as [
        { data: Record<string, unknown> },
      ];
      expect(call[0].data.createdById).toBe('jwt-sub-id');
    });

    it('should throw UnauthorizedException if no user ID or sub is present', async () => {
      await expect(
        service.create({ personId: 'person-1' }, { churchId: 'church-1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findAll', () => {
    it('should return paginated check-ins with filters', async () => {
      prismaMock.pastoralCheckIn.findMany.mockResolvedValue([
        { id: 'checkin-1', status: CheckInStatus.SCHEDULED },
      ]);
      prismaMock.pastoralCheckIn.count.mockResolvedValue(1);

      const result = await service.findAll(
        {
          page: 1,
          limit: 10,
          status: CheckInStatus.SCHEDULED,
          reason: CheckInReason.ABSENTEEISM,
          search: 'service',
        },
        'church-1',
      );

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return single check-in by id', async () => {
      prismaMock.pastoralCheckIn.findFirst.mockResolvedValue({
        id: 'checkin-1',
      });

      const result = await service.findOne('checkin-1', 'church-1');
      expect(result.id).toBe('checkin-1');
    });

    it('should throw NotFoundException if not found', async () => {
      prismaMock.pastoralCheckIn.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('missing-checkin', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByPerson', () => {
    it('should return check-ins for a person', async () => {
      prismaMock.person.findFirst.mockResolvedValue({ id: 'person-1' });
      prismaMock.pastoralCheckIn.findMany.mockResolvedValue([
        { id: 'checkin-1', personId: 'person-1' },
      ]);

      const result = await service.findByPerson('person-1', 'church-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('checkin-1');
    });

    it('should throw NotFoundException if person does not exist', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.findByPerson('missing-person', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update check-in and set completedAt if marked COMPLETED', async () => {
      prismaMock.pastoralCheckIn.findFirst.mockResolvedValue({
        id: 'checkin-1',
        churchId: 'church-1',
        status: CheckInStatus.SCHEDULED,
        completedAt: null,
      });
      prismaMock.pastoralCheckIn.update.mockResolvedValue({
        id: 'checkin-1',
        status: CheckInStatus.COMPLETED,
        completedAt: new Date(),
        outcome: 'Followed up successfully',
      });

      const result = await service.update(
        'checkin-1',
        {
          status: CheckInStatus.COMPLETED,
          outcome: 'Followed up successfully',
        },
        'church-1',
      );

      expect(result.id).toBe('checkin-1');
      expect(prismaMock.pastoralCheckIn.update).toHaveBeenCalledTimes(1);
      const updateCall = prismaMock.pastoralCheckIn.update.mock.calls[0] as [
        { where: { id: string }; data: Record<string, unknown> },
      ];
      expect(updateCall[0].where).toEqual({ id: 'checkin-1' });
      expect(updateCall[0].data.status).toBe(CheckInStatus.COMPLETED);
      expect(updateCall[0].data.outcome).toBe('Followed up successfully');
      expect(updateCall[0].data.completedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if newly assigned user does not exist', async () => {
      prismaMock.pastoralCheckIn.findFirst.mockResolvedValue({
        id: 'checkin-1',
        churchId: 'church-1',
        personId: 'person-1',
      });
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'checkin-1',
          { assignedToId: 'missing-user' },
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete check-in', async () => {
      prismaMock.pastoralCheckIn.findFirst.mockResolvedValue({
        id: 'checkin-1',
      });
      prismaMock.pastoralCheckIn.delete.mockResolvedValue({ id: 'checkin-1' });

      const result = await service.remove('checkin-1', 'church-1');
      expect(result.message).toContain('deleted successfully');
      expect(prismaMock.pastoralCheckIn.delete).toHaveBeenCalledWith({
        where: { id: 'checkin-1' },
      });
    });
  });
});
