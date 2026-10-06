import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from './attendance.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    registration: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    attendance: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      registration: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      attendance: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(
        (
          promises: Promise<unknown>[] | ((tx: unknown) => Promise<unknown>),
        ): Promise<unknown> => {
          if (Array.isArray(promises)) {
            return Promise.all(promises);
          }
          return promises(prismaMock);
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  describe('checkIn', () => {
    it('should successfully check in an attendee via valid QR token', async () => {
      const mockRegistration = {
        id: 'reg-1',
        registrationNumber: 'REG-100',
        token: 'token-abc-123',
        status: RegistrationStatus.CONFIRMED,
        attendance: null,
        person: {
          id: 'person-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
          phone: '+1234567890',
        },
        event: {
          id: 'event-1',
          title: 'Youth Camp 2026',
          churchId: 'church-1',
        },
        team: {
          id: 'team-1',
          name: 'Blue Eagles',
          color: '#0000FF',
        },
      };

      const mockAttendance = {
        id: 'att-1',
        registrationId: 'reg-1',
        checkedInBy: 'admin-user-1',
        checkedInAt: new Date(),
      };

      prismaMock.registration.findUnique.mockResolvedValue(mockRegistration);
      prismaMock.attendance.create.mockResolvedValue(mockAttendance);
      prismaMock.registration.update.mockResolvedValue({
        ...mockRegistration,
        status: RegistrationStatus.CHECKED_IN,
      });

      const result = await service.checkIn(
        { token: 'token-abc-123' },
        'admin-user-1',
        'church-1',
      );

      expect(result.message).toBe('Check-in successful');
      expect(result.status).toBe(RegistrationStatus.CHECKED_IN);
      expect(result.person.firstName).toBe('Jane');
      expect(result.team?.name).toBe('Blue Eagles');
      expect(prismaMock.attendance.create).toHaveBeenCalledWith({
        data: {
          registrationId: 'reg-1',
          checkedInBy: 'admin-user-1',
        },
      });
      expect(prismaMock.registration.update).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        data: { status: RegistrationStatus.CHECKED_IN },
      });
    });

    it('should throw NotFoundException if token is invalid or registration not found', async () => {
      prismaMock.registration.findUnique.mockResolvedValue(null);

      await expect(
        service.checkIn({ token: 'invalid-token' }, 'admin-1', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if event belongs to another church', async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        token: 'token-other-church',
        event: { id: 'event-1', churchId: 'other-church' },
        attendance: null,
      });

      await expect(
        service.checkIn({ token: 'token-other-church' }, 'admin-1', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if attendee has already checked in', async () => {
      prismaMock.registration.findUnique.mockResolvedValue({
        id: 'reg-1',
        token: 'token-already-checked-in',
        attendance: { id: 'att-existing', checkedInAt: new Date() },
        event: { id: 'event-1', churchId: 'church-1' },
        person: { id: 'p1' },
        team: { id: 't1' },
      });

      await expect(
        service.checkIn(
          { token: 'token-already-checked-in' },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated attendance records scoped to church', async () => {
      const mockItems = [
        {
          id: 'att-1',
          checkedInAt: new Date(),
          checkedInBy: 'admin-1',
          registration: {
            id: 'reg-1',
            registrationNumber: 'REG-100',
            person: { firstName: 'Jane', lastName: 'Doe' },
            event: { id: 'event-1', title: 'Camp' },
            team: { id: 'team-1', name: 'Blue Eagles' },
          },
        },
      ];

      prismaMock.attendance.findMany.mockResolvedValue(mockItems);
      prismaMock.attendance.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'Jane' },
        'church-1',
      );

      expect(result.items).toEqual(mockItems);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(prismaMock.attendance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
          orderBy: { checkedInAt: 'desc' },
        }),
      );
    });
  });

  describe('exportAll', () => {
    it('should return attendance records for CSV export', async () => {
      const mockItems = [
        {
          id: 'att-1',
          checkedInAt: new Date(),
          registration: {
            registrationNumber: 'REG-100',
            person: { firstName: 'Jane', lastName: 'Doe' },
            event: { title: 'Camp' },
            team: { name: 'Blue Eagles' },
          },
        },
      ];

      prismaMock.attendance.findMany.mockResolvedValue(mockItems);

      const result = await service.exportAll({}, 'church-1');
      expect(result).toEqual(mockItems);
    });
  });

  describe('undoCheckIn', () => {
    it('should delete attendance and reset registration status to CONFIRMED', async () => {
      const mockAttendance = {
        id: 'att-1',
        registrationId: 'reg-1',
        registration: {
          id: 'reg-1',
          status: RegistrationStatus.CHECKED_IN,
          event: { churchId: 'church-1' },
        },
      };

      prismaMock.attendance.findFirst.mockResolvedValue(mockAttendance);
      prismaMock.attendance.delete.mockResolvedValue(mockAttendance);
      prismaMock.registration.update.mockResolvedValue({
        id: 'reg-1',
        status: RegistrationStatus.CONFIRMED,
      });

      const result = await service.undoCheckIn('att-1', 'church-1');

      expect(result.message).toBe('Check-in undone successfully');
      expect(result.attendanceId).toBe('att-1');
      expect(result.registrationId).toBe('reg-1');
      expect(prismaMock.attendance.delete).toHaveBeenCalledWith({
        where: { id: 'att-1' },
      });
      expect(prismaMock.registration.update).toHaveBeenCalledWith({
        where: { id: 'reg-1' },
        data: { status: RegistrationStatus.CONFIRMED },
      });
    });

    it('should throw NotFoundException if attendance record is not found', async () => {
      prismaMock.attendance.findFirst.mockResolvedValue(null);

      await expect(
        service.undoCheckIn('att-not-found', 'church-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
