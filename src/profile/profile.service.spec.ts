import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@prisma/client';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { callArg } from '../common/testing/mock.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimRateLimiter } from './claim-rate-limiter';
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
      count: jest.Mock;
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
        count: jest.fn().mockResolvedValue(2),
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
        ClaimRateLimiter,
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

    it('matches an existing person by normalised or as-typed phone', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        email: null,
        phone: '08034567890',
      });
      prismaMock.person.update.mockResolvedValue({});

      await service.claim({ phone: '08034567890' });

      expect(prismaMock.person.findFirst).toHaveBeenCalledWith({
        where: {
          churchId: 'church-1',
          OR: [{ phone: '+2348034567890' }, { phone: '08034567890' }],
        },
      });
    });

    it('stores a new visitor phone in E.164 and drops an unusable one', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      prismaMock.person.create.mockResolvedValue({
        id: 'new-1',
        firstName: 'Sarah',
        lastName: 'Guest',
        email: 'sarah@example.com',
        phone: null,
      });
      prismaMock.person.update.mockResolvedValue({});

      await service.claim({
        email: 'sarah@example.com',
        phone: '0803 456 7890',
      });
      expect(callArg(prismaMock.person.create, 0).data.phone).toBe(
        '+2348034567890',
      );

      await service.claim({ email: 'sarah2@example.com', phone: '12' });
      expect(callArg(prismaMock.person.create, 1).data.phone).toBeNull();
    });

    it('rejects a phone-only claim when the number is unusable', async () => {
      await expect(service.claim({ phone: '12' })).rejects.toThrow(
        BadRequestException,
      );
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
        namesConfirmed: true,
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

  describe('claim (hardening)', () => {
    it('creates new visitors with placeholder names flagged unconfirmed', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);
      prismaMock.person.create.mockResolvedValue({
        id: 'new-1',
        firstName: 'New',
        lastName: 'Visitor',
        namesConfirmed: false,
        email: 'sarah.adeyemi@example.com',
      });
      prismaMock.person.update.mockResolvedValue({});

      await service.claim({ email: 'sarah.adeyemi@example.com' });

      const data = callArg(prismaMock.person.create).data;
      expect(data).toMatchObject({
        firstName: 'New',
        lastName: 'Visitor',
        namesConfirmed: false,
      });
      const email = callArg<{ message: string; subject: string }>(
        emailProviderMock.sendCustomBroadcast,
      );
      expect(email.message.startsWith('Hello,')).toBe(true);
      expect(email.subject).toBe('Update your details with Amazing Grace');
      expect(email.message).not.toMatch(/magic link/i);
    });

    it('creates nothing for a phone-only claim that matches no one', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      const result = await service.claim({ phone: '08034567890' });

      expect(result.message).toContain('magic link has been sent');
      expect(prismaMock.person.create).not.toHaveBeenCalled();
      expect(emailProviderMock.sendCustomBroadcast).not.toHaveBeenCalled();
    });

    it('resets profileTokenOpenedAt when issuing a token', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        namesConfirmed: true,
        email: 'john@example.com',
      });
      prismaMock.person.update.mockResolvedValue({});

      await service.claim({ email: 'john@example.com' });

      expect(callArg(prismaMock.person.update).data).toMatchObject({
        profileTokenOpenedAt: null,
      });
    });

    it('returns the generic 200 and sends nothing when the email is rate limited', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        namesConfirmed: true,
        email: 'john@example.com',
      });
      prismaMock.person.update.mockResolvedValue({});

      const first = await service.claim({ email: 'john@example.com' });
      const second = await service.claim({ email: 'John@Example.com' });

      expect(second).toEqual(first);
      expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledTimes(1);
      expect(prismaMock.person.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('link validity', () => {
    const base = {
      id: 'person-1',
      churchId: 'church-1',
      namesConfirmed: true,
      church: { id: 'church-1' },
      departmentMemberships: [],
    };

    const errorCode = async (promise: Promise<unknown>) => {
      try {
        await promise;
      } catch (e) {
        return ((e as BadRequestException).getResponse() as { code: string })
          .code;
      }
      return undefined;
    };

    it('uses PROFILE_LINK_INVALID for unknown tokens on GET and PATCH', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null);
      expect(await errorCode(service.getByToken('x'))).toBe(
        'PROFILE_LINK_INVALID',
      );
      expect(await errorCode(service.updateByToken('x', {}))).toBe(
        'PROFILE_LINK_INVALID',
      );
    });

    it('uses PROFILE_LINK_EXPIRED for expired tokens', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...base,
        profileTokenExpiresAt: new Date(Date.now() - 60_000),
        profileTokenOpenedAt: null,
      });
      expect(await errorCode(service.getByToken('x'))).toBe(
        'PROFILE_LINK_EXPIRED',
      );
      expect(await errorCode(service.updateByToken('x', {}))).toBe(
        'PROFILE_LINK_EXPIRED',
      );
    });

    it('GET records the first open time', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...base,
        profileTokenExpiresAt: new Date(Date.now() + 60_000),
        profileTokenOpenedAt: null,
      });
      await service.getByToken('x');
      expect(callArg(prismaMock.person.update).data).toHaveProperty(
        'profileTokenOpenedAt',
      );
    });

    it('PATCH accepts an expired link opened in time, within the grace window', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...base,
        profileTokenExpiresAt: new Date(Date.now() - 60_000),
        profileTokenOpenedAt: new Date(Date.now() - 5 * 60_000),
      });
      const result = await service.updateByToken('x', { firstName: 'Jane' });
      expect(result.message).toContain('Profile updated successfully');
    });

    it('PATCH rejects once the grace window has passed', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...base,
        profileTokenExpiresAt: new Date(Date.now() - 40 * 60_000),
        profileTokenOpenedAt: new Date(Date.now() - 35 * 60_000),
      });
      expect(await errorCode(service.updateByToken('x', {}))).toBe(
        'PROFILE_LINK_EXPIRED',
      );
    });

    it('GET never honours the grace window for a link first opened after expiry', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...base,
        profileTokenExpiresAt: new Date(Date.now() - 60_000),
        profileTokenOpenedAt: new Date(Date.now() - 120_000),
      });
      expect(await errorCode(service.getByToken('x'))).toBe(
        'PROFILE_LINK_EXPIRED',
      );
    });
  });

  describe('updateByToken rules', () => {
    const person = (over: Record<string, unknown> = {}) => ({
      id: 'person-1',
      churchId: 'church-1',
      namesConfirmed: true,
      membershipStatus: MembershipStatus.VISITOR,
      profileTokenExpiresAt: new Date(Date.now() + 60_000),
      departmentMemberships: [],
      ...over,
    });
    const codeOf = async (promise: Promise<unknown>) => {
      try {
        await promise;
      } catch (e) {
        return ((e as BadRequestException).getResponse() as { code: string })
          .code;
      }
      return undefined;
    };

    it('requires both names while namesConfirmed is false', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        person({ namesConfirmed: false }),
      );
      expect(await codeOf(service.updateByToken('x', { firstName: 'A' }))).toBe(
        'NAMES_REQUIRED',
      );
    });

    it('confirms names on a successful save', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        person({ namesConfirmed: false }),
      );
      await service.updateByToken('x', { firstName: 'A', lastName: 'B' });
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('rejects a WORKER with no departments when the church has some', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());
      expect(
        await codeOf(
          service.updateByToken('x', {
            membershipStatus: MembershipStatus.WORKER,
            departmentIds: [],
          }),
        ),
      ).toBe('DEPARTMENT_REQUIRED');
    });

    it('lets a WORKER save when the church has no departments', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());
      prismaMock.department.count.mockResolvedValue(0);
      const result = await service.updateByToken('x', {
        membershipStatus: MembershipStatus.WORKER,
      });
      expect(result.message).toContain('Profile updated successfully');
    });

    it('clears departments for a MEMBER', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());
      const tx = {
        person: { update: jest.fn().mockResolvedValue({ id: 'person-1' }) },
        departmentMembership: {
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      prismaMock.$transaction.mockImplementationOnce(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );

      await service.updateByToken('x', {
        membershipStatus: MembershipStatus.MEMBER,
        departmentIds: ['dept-1'],
      });

      expect(tx.departmentMembership.deleteMany).toHaveBeenCalledWith({
        where: { personId: 'person-1', departmentId: { notIn: [] } },
      });
      expect(tx.departmentMembership.create).not.toHaveBeenCalled();
    });
  });
});
