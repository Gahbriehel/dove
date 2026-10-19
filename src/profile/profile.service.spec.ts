import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@prisma/client';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from './profile.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    person: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    department: {
      findMany: jest.Mock;
    };
    departmentMembership: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let departmentsServiceMock: {
    listForChurch: jest.Mock;
  };
  let emailProviderMock: {
    sendCustomBroadcast: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'church-1',
          name: 'Amazing Grace',
          slug: 'abwog',
        }),
      },
      person: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      department: {
        findMany: jest.fn(),
      },
      departmentMembership: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            person: {
              update: jest.fn().mockResolvedValue({
                id: 'person-1',
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                membershipStatus: MembershipStatus.WORKER,
              }),
            },
            departmentMembership: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              create: jest.fn().mockResolvedValue({}),
              findMany: jest.fn().mockResolvedValue([
                {
                  department: {
                    id: 'dept-1',
                    name: 'Choir',
                    description: 'Music',
                  },
                  role: 'Member',
                  joinedAt: new Date(),
                },
              ]),
            },
          }),
        ),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'appUrl') return 'https://api.abwog.org';
        if (key === 'profileUrl') return 'https://app.abwog.org/profile';
        return undefined;
      }),
    };

    departmentsServiceMock = {
      listForChurch: jest.fn().mockResolvedValue([
        { id: 'dept-1', name: 'Choir', description: 'Music' },
        { id: 'dept-2', name: 'Media', description: 'AV' },
      ]),
    };

    emailProviderMock = {
      sendCustomBroadcast: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: DepartmentsService,
          useValue: departmentsServiceMock,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: emailProviderMock,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  describe('claim', () => {
    it('should throw BadRequestException if neither email nor phone is provided', async () => {
      await expect(service.claim({})).rejects.toThrow(BadRequestException);
    });

    it('should claim for existing person and dispatch magic link email', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: null,
      });
      prismaMock.person.update.mockResolvedValue({});

      const result = await service.claim({ email: 'john@example.com' });

      expect(result.message).toContain('magic link has been sent');
      expect(prismaMock.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'person-1' },
        }),
      );
      expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledTimes(1);
    });

    it('should create visitor record and dispatch magic link when person not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      prismaMock.person.create.mockResolvedValue({
        id: 'new-person-1',
        firstName: 'Sarah',
        lastName: 'Guest',
        email: 'sarah@example.com',
        phone: null,
      });
      prismaMock.person.update.mockResolvedValue({});

      const result = await service.claim({ email: 'sarah@example.com' });

      expect(result.message).toContain('magic link has been sent');
      expect(prismaMock.person.create).toHaveBeenCalled();
      expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalled();
    });

    it('should throw NotFoundException if church slug is invalid', async () => {
      prismaMock.church.findUnique.mockResolvedValue(null);

      await expect(
        service.claim({
          email: 'user@example.com',
          churchSlug: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByToken', () => {
    it('should throw BadRequestException when token is empty', async () => {
      await expect(service.getByToken('')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when token not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null);

      await expect(service.getByToken('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when token has expired', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        id: 'person-1',
        profileTokenExpiresAt: new Date(Date.now() - 60000), // 1 min ago
      });

      await expect(service.getByToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return person, church, and availableDepartments when token is valid', async () => {
      const validFutureDate = new Date(Date.now() + 15 * 60 * 1000);
      prismaMock.person.findUnique.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
        firstName: 'David',
        lastName: 'Miller',
        email: 'david@example.com',
        phone: '+1234567890',
        gender: 'MALE',
        dateOfBirth: new Date('1990-01-01'),
        address: '10 High St',
        membershipStatus: MembershipStatus.MEMBER,
        profileTokenExpiresAt: validFutureDate,
        church: {
          id: 'church-1',
          name: 'Amazing Grace',
          slug: 'abwog',
        },
        departmentMemberships: [],
      });

      const result = await service.getByToken('valid-token');

      expect(result.person.firstName).toBe('David');
      expect(result.church.slug).toBe('abwog');
      expect(result.availableDepartments.length).toBe(2);
      expect(departmentsServiceMock.listForChurch).toHaveBeenCalledWith(
        'church-1',
      );
    });
  });

  describe('updateByToken', () => {
    it('should throw BadRequestException if token not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null);

      await expect(
        service.updateByToken('invalid', { firstName: 'Jane' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if department IDs are invalid for this church', async () => {
      const validFutureDate = new Date(Date.now() + 15 * 60 * 1000);
      prismaMock.person.findUnique.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
        profileTokenExpiresAt: validFutureDate,
        departmentMemberships: [],
      });
      prismaMock.department.findMany.mockResolvedValue([]); // No matching dept

      await expect(
        service.updateByToken('valid', { departmentIds: ['dept-bad'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update profile, sync departments, and invalidate token on success', async () => {
      const validFutureDate = new Date(Date.now() + 15 * 60 * 1000);
      prismaMock.person.findUnique.mockResolvedValue({
        id: 'person-1',
        churchId: 'church-1',
        profileTokenExpiresAt: validFutureDate,
        departmentMemberships: [],
      });
      prismaMock.department.findMany.mockResolvedValue([{ id: 'dept-1' }]);

      const result = await service.updateByToken('valid-token', {
        firstName: 'Jane',
        membershipStatus: MembershipStatus.WORKER,
        departmentIds: ['dept-1'],
      });

      expect(result.message).toContain('Profile updated successfully');
      expect(result.person.firstName).toBe('Jane');
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });
});
