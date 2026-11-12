/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Gender,
  MembershipStatus,
  Prisma,
  RelationshipType,
} from '@prisma/client';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { callArg } from '../common/testing/mock.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimRateLimiter } from './claim-rate-limiter';
import { MemberSessionService } from './member-session.service';
import { ProfileService } from './profile.service';
import { RelativeRateLimiter } from './relative-rate-limiter';
import {
  CONTACT_ALREADY_REGISTERED_CODE,
  CONTACT_REQUIRED_CODE,
} from '../people/people.constants';

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
    personRelationship: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
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
  let jwtServiceMock: {
    signAsync: jest.Mock;
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
      personRelationship: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            person: {
              create: jest.fn().mockImplementation(
                (args: {
                  data: {
                    churchId: string;
                    firstName: string;
                    lastName: string;
                    email: string | null;
                    phone: string | null;
                  };
                }) =>
                  Promise.resolve({
                    id: 'relative-1',
                    churchId: args.data.churchId,
                    firstName: args.data.firstName,
                    lastName: args.data.lastName,
                    email: args.data.email,
                    phone: args.data.phone,
                    pinHash: null,
                  }),
              ),
              update: jest.fn().mockResolvedValue({
                id: 'person-1',
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
                membershipStatus: MembershipStatus.WORKER,
              }),
            },
            personRelationship: {
              create: jest
                .fn()
                .mockImplementation((args: { data: Record<string, unknown> }) =>
                  Promise.resolve({
                    id: 'rel-1',
                    ...args.data,
                  }),
                ),
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
    jwtServiceMock = {
      signAsync: jest.fn().mockResolvedValue('mock-member-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        ClaimRateLimiter,
        MemberSessionService,
        RelativeRateLimiter,
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
          provide: JwtService,
          useValue: jwtServiceMock,
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

    it('creates visitor without phone when email is unknown and phone belongs to someone else', async () => {
      prismaMock.person.findFirst
        .mockResolvedValueOnce(null) // email lookup
        .mockResolvedValueOnce({ id: 'existing-phone-owner' }); // phone conflict search
      prismaMock.person.create.mockResolvedValue({
        id: 'new-person-2',
        firstName: 'New',
        lastName: 'Visitor',
        email: 'newbie@example.com',
        phone: null,
      });
      prismaMock.person.update.mockResolvedValue({});

      const result = await service.claim({
        email: 'newbie@example.com',
        phone: '08034567890',
      });

      expect(result.message).toContain('magic link has been sent');
      expect(prismaMock.person.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newbie@example.com',
          phone: null,
          membershipStatus: MembershipStatus.VISITOR,
        }),
      });
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

      const result = (await service.updateByToken('valid-token', {
        firstName: 'Jane',
        membershipStatus: MembershipStatus.WORKER,
        departmentIds: ['dept-1'],
      })) as { message: string; person: { firstName: string } };

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

    it('hashes PIN and stores it when pin is provided in updateByToken', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());
      const tx = {
        person: {
          update: jest
            .fn()
            .mockResolvedValue({ id: 'person-1', pinHash: 'hashed-pin' }),
        },
        departmentMembership: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      prismaMock.$transaction.mockImplementationOnce(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );

      const result = (await service.updateByToken('x', {
        pin: '2846',
      })) as { person: { hasPin: boolean }; accessToken?: string };

      expect(tx.person.update).toHaveBeenCalled();
      const updateData = callArg(tx.person.update).data;
      expect(updateData.pinHash).toBeDefined();
      expect(updateData.pinHash).not.toBe('2846'); // Must be hashed
      expect(updateData.pinFailedAttempts).toBe(0);
      expect(updateData.pinLockedUntil).toBeNull();
      expect(result.person.hasPin).toBe(true);
      expect(result.accessToken).toBe('mock-member-jwt-token');
    });

    it('rejects weak PIN on updateByToken with PIN_TOO_WEAK', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());

      await expect(
        service.updateByToken('x', { pin: '1234' }),
      ).rejects.toMatchObject({
        response: { code: 'PIN_TOO_WEAK' },
      });

      await expect(
        service.updateByToken('x', { pin: '0000' }),
      ).rejects.toMatchObject({
        response: { code: 'PIN_TOO_WEAK' },
      });

      await expect(
        service.updateByToken('x', { pin: '4321' }),
      ).rejects.toMatchObject({
        response: { code: 'PIN_TOO_WEAK' },
      });

      await expect(
        service.updateByToken('x', { pin: '1212' }),
      ).rejects.toMatchObject({
        response: { code: 'PIN_TOO_WEAK' },
      });
    });

    it('omits accessToken on updateByToken when person has no PIN after save', async () => {
      prismaMock.person.findUnique.mockResolvedValue(person());
      const tx = {
        person: {
          update: jest
            .fn()
            .mockResolvedValue({ id: 'person-1', pinHash: null }),
        },
        departmentMembership: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
      };
      prismaMock.$transaction.mockImplementationOnce(
        (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );

      const result = (await service.updateByToken('x', {
        firstName: 'Jane',
      })) as { person: { hasPin: boolean }; accessToken?: string };

      expect(result.person.hasPin).toBe(false);
      expect(result.accessToken).toBeUndefined();
    });

    it('rejects with CONTACT_ALREADY_REGISTERED when updating to taken email', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...person(),
        email: 'old@example.com',
      });
      prismaMock.person.findFirst.mockResolvedValue({ id: 'other-person' });

      await expect(
        service.updateByToken('x', { email: 'taken@example.com' }),
      ).rejects.toMatchObject({
        response: { code: 'CONTACT_ALREADY_REGISTERED' },
      });
    });

    it('rejects with CONTACT_ALREADY_REGISTERED when updating to taken phone', async () => {
      prismaMock.person.findUnique.mockResolvedValue({
        ...person(),
        phone: '+2348011111111',
      });
      prismaMock.person.findFirst.mockResolvedValue({ id: 'other-person' });

      await expect(
        service.updateByToken('x', { phone: '08034567890' }),
      ).rejects.toMatchObject({
        response: { code: 'CONTACT_ALREADY_REGISTERED' },
      });
    });
  });

  describe('login (member PIN authentication)', () => {
    const validPerson = (overrides = {}) => ({
      id: 'p-1',
      churchId: 'church-1',
      firstName: 'Sarah',
      lastName: 'Adeyemi',
      email: 'sarah@example.com',
      phone: '+2348012345678',
      membershipStatus: MembershipStatus.WORKER,
      namesConfirmed: true,
      // bcrypt hash for "1234"
      pinHash: '$2b$10$a2ElV7W5iQIHqLvwKiPpcO/KcRufocp3bOXORd4oDwf..hIO4Tghi',
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      church: {
        id: 'church-1',
        name: 'Amazing Grace',
        slug: 'abwog',
      },
      departmentMemberships: [],
      ...overrides,
    });

    it('successfully logs in with email and correct PIN', async () => {
      prismaMock.person.findFirst.mockResolvedValue(validPerson());

      const result = await service.login({
        identifier: 'sarah@example.com',
        pin: '1234',
      });

      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toBe('mock-member-jwt-token');
      expect(result.person.id).toBe('p-1');
      expect(result.person.hasPin).toBe(true);
    });

    it('successfully logs in with phone number and correct PIN', async () => {
      prismaMock.person.findFirst.mockResolvedValue(validPerson());

      const result = await service.login({
        identifier: '08012345678',
        pin: '1234',
      });

      expect(result.accessToken).toBe('mock-member-jwt-token');
      expect(prismaMock.person.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phone: '+2348012345678', churchId: 'church-1' },
        }),
      );
    });

    it('finds person using candidate phone search if domestic format is stored in DB', async () => {
      prismaMock.person.findFirst
        .mockResolvedValueOnce(null) // first try with +234... fails
        .mockResolvedValueOnce(validPerson({ phone: '08012345678' })); // fallback finds it

      const result = await service.login({
        identifier: '+2348012345678',
        pin: '1234',
      });

      expect(result.accessToken).toBe('mock-member-jwt-token');
      expect(prismaMock.person.findFirst).toHaveBeenCalledTimes(2);
    });

    it('throws UnauthorizedException if person is not found', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'unknown@example.com', pin: '1234' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException with NO_PIN_SET if person has no PIN configured', async () => {
      prismaMock.person.findFirst.mockResolvedValue(
        validPerson({ pinHash: null }),
      );

      await expect(
        service.login({ identifier: 'sarah@example.com', pin: '1234' }),
      ).rejects.toMatchObject({
        response: { code: 'NO_PIN_SET' },
      });
    });

    it('increments failed attempts on incorrect PIN', async () => {
      prismaMock.person.findFirst.mockResolvedValue(
        validPerson({ pinFailedAttempts: 1 }),
      );
      prismaMock.person.update.mockResolvedValue({});

      await expect(
        service.login({ identifier: 'sarah@example.com', pin: '9999' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_PIN', attemptsRemaining: 3 },
      });

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { pinFailedAttempts: 2, pinLockedUntil: null },
      });
    });

    it('locks account for 15 minutes when reaching 5 failed attempts and returns lockedUntil', async () => {
      prismaMock.person.findFirst.mockResolvedValue(
        validPerson({ pinFailedAttempts: 4 }),
      );
      prismaMock.person.update.mockResolvedValue({});

      try {
        await service.login({ identifier: 'sarah@example.com', pin: '9999' });
        fail('Expected login to throw');
      } catch (err: unknown) {
        const error = err as {
          response: { code: string; lockedUntil: string };
        };
        expect(error.response).toMatchObject({ code: 'PIN_LOCKED' });
        expect(error.response.lockedUntil).toBeDefined();
        expect(new Date(error.response.lockedUntil).getTime()).toBeGreaterThan(
          Date.now(),
        );
      }

      const updateData = callArg(prismaMock.person.update).data;
      expect(updateData.pinFailedAttempts).toBe(0);
      expect(updateData.pinLockedUntil).toBeInstanceOf(Date);
    });

    it('rejects login immediately if account is currently locked and returns lockedUntil', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      prismaMock.person.findFirst.mockResolvedValue(
        validPerson({ pinLockedUntil: lockedUntil }),
      );

      try {
        await service.login({ identifier: 'sarah@example.com', pin: '1234' });
        fail('Expected login to throw');
      } catch (err: unknown) {
        const error = err as {
          response: { code: string; lockedUntil: string };
        };
        expect(error.response).toMatchObject({ code: 'PIN_LOCKED' });
        expect(error.response.lockedUntil).toBe(lockedUntil.toISOString());
      }
    });
  });

  describe('getMe', () => {
    it('returns formatted person, church, and sliding session accessToken', async () => {
      const personData = {
        id: 'p-1',
        churchId: 'church-1',
        firstName: 'Sarah',
        lastName: 'Adeyemi',
        email: 'sarah@example.com',
        phone: '+2348012345678',
        gender: null,
        dateOfBirth: null,
        address: null,
        membershipStatus: MembershipStatus.WORKER,
        namesConfirmed: true,
        pinHash: 'hashed',
        church: { id: 'church-1', name: 'Amazing Grace' },
        departmentMemberships: [],
      };
      prismaMock.person.findUnique.mockResolvedValue(personData);

      const result = await service.getMe('p-1');
      expect(result.person.id).toBe('p-1');
      expect(result.person.hasPin).toBe(true);
      expect(result.church.id).toBe('church-1');
      expect(result.accessToken).toBe('mock-member-jwt-token');
    });

    it('throws UnauthorizedException when person is not found', async () => {
      prismaMock.person.findUnique.mockResolvedValue(null);
      await expect(service.getMe('non-existent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('changePin', () => {
    const existingPerson = (overrides = {}) => ({
      id: 'p-1',
      churchId: 'church-1',
      pinHash: '$2b$10$a2ElV7W5iQIHqLvwKiPpcO/KcRufocp3bOXORd4oDwf..hIO4Tghi', // '1234'
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      ...overrides,
    });

    it('rejects weak new PIN with 400 PIN_TOO_WEAK', async () => {
      await expect(
        service.changePin('p-1', { currentPin: '1234', newPin: '0000' }),
      ).rejects.toMatchObject({
        response: { code: 'PIN_TOO_WEAK' },
      });
    });

    it('rejects if account is already locked and returns lockedUntil', async () => {
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      prismaMock.person.findUnique.mockResolvedValue(
        existingPerson({ pinLockedUntil: lockedUntil }),
      );

      try {
        await service.changePin('p-1', { currentPin: '1234', newPin: '8137' });
        fail('Expected changePin to throw');
      } catch (err: unknown) {
        const error = err as {
          response: { code: string; lockedUntil: string };
        };
        expect(error.response).toMatchObject({ code: 'PIN_LOCKED' });
        expect(error.response.lockedUntil).toBe(lockedUntil.toISOString());
      }
    });

    it('allows setting PIN without currentPin when person has no PIN set yet', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        existingPerson({ pinHash: null }),
      );
      prismaMock.person.update.mockResolvedValue({});

      const result = await service.changePin('p-1', { newPin: '8137' });
      expect(result.message).toBe('PIN updated successfully');
      const updateCall = callArg<{
        where: { id: string };
        data: { pinFailedAttempts: number; pinLockedUntil: null };
      }>(prismaMock.person.update);
      expect(updateCall.where.id).toBe('p-1');
      expect(updateCall.data.pinFailedAttempts).toBe(0);
      expect(updateCall.data.pinLockedUntil).toBeNull();
    });

    it('requires currentPin when person already has a PIN', async () => {
      prismaMock.person.findUnique.mockResolvedValue(existingPerson());

      await expect(
        service.changePin('p-1', { newPin: '8137' }),
      ).rejects.toMatchObject({
        response: { code: 'CURRENT_PIN_REQUIRED' },
      });
    });

    it('increments failed attempts when currentPin is wrong', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        existingPerson({ pinFailedAttempts: 2 }),
      );
      prismaMock.person.update.mockResolvedValue({});

      await expect(
        service.changePin('p-1', { currentPin: '9999', newPin: '8137' }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_PIN', attemptsRemaining: 2 },
      });

      expect(prismaMock.person.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { pinFailedAttempts: 3, pinLockedUntil: null },
      });
    });

    it('locks account on 5th incorrect currentPin attempt and returns lockedUntil', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        existingPerson({ pinFailedAttempts: 4 }),
      );
      prismaMock.person.update.mockResolvedValue({});

      try {
        await service.changePin('p-1', { currentPin: '9999', newPin: '8137' });
        fail('Expected changePin to throw');
      } catch (err: unknown) {
        const error = err as {
          response: { code: string; lockedUntil: string };
        };
        expect(error.response).toMatchObject({ code: 'PIN_LOCKED' });
        expect(error.response.lockedUntil).toBeDefined();
      }

      const updateData = callArg(prismaMock.person.update).data;
      expect(updateData.pinFailedAttempts).toBe(0);
      expect(updateData.pinLockedUntil).toBeInstanceOf(Date);
    });

    it('successfully changes PIN with valid currentPin and resets failed attempts', async () => {
      prismaMock.person.findUnique.mockResolvedValue(
        existingPerson({ pinFailedAttempts: 3 }),
      );
      prismaMock.person.update.mockResolvedValue({});

      const result = await service.changePin('p-1', {
        currentPin: '1234',
        newPin: '8137',
      });

      expect(result.message).toBe('PIN updated successfully');
      const updateData = callArg(prismaMock.person.update).data;
      expect(updateData.pinHash).toBeDefined();
      expect(updateData.pinFailedAttempts).toBe(0);
      expect(updateData.pinLockedUntil).toBeNull();
    });
  });

  describe('logout', () => {
    it('revokes member session jti and rawToken', async () => {
      const sessionService = (
        service as unknown as { memberSessionService: MemberSessionService }
      ).memberSessionService;
      const revokeSpy = jest.spyOn(sessionService, 'revoke');

      const payload = {
        sub: 'p-1',
        churchId: 'church-1',
        jti: 'jti-abc',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const result = await service.logout(payload, 'token-raw');
      expect(result.message).toBe('Logged out successfully');
      expect(revokeSpy).toHaveBeenCalledWith('jti-abc', payload.exp * 1000);
      expect(revokeSpy).toHaveBeenCalledWith('token-raw', payload.exp * 1000);
    });
  });

  describe('relatives', () => {
    describe('addRelative', () => {
      it('rejects when neither email nor phone is provided', async () => {
        await expect(
          service.addRelative('member-1', 'church-1', {
            firstName: 'Tunde',
            lastName: 'Adeyemi',
            relationship: RelationshipType.SPOUSE,
          }),
        ).rejects.toMatchObject({
          response: { code: CONTACT_REQUIRED_CODE },
        });
      });

      it('rejects when email already exists in church', async () => {
        prismaMock.person.findFirst.mockResolvedValueOnce({ id: 'existing-1' });

        await expect(
          service.addRelative('member-1', 'church-1', {
            firstName: 'Tunde',
            lastName: 'Adeyemi',
            relationship: RelationshipType.SPOUSE,
            email: 'existing@example.com',
          }),
        ).rejects.toMatchObject({
          response: { code: CONTACT_ALREADY_REGISTERED_CODE },
        });
      });

      it('rejects when phone already exists in church', async () => {
        prismaMock.person.findFirst.mockResolvedValueOnce({ id: 'existing-2' });

        await expect(
          service.addRelative('member-1', 'church-1', {
            firstName: 'Tunde',
            lastName: 'Adeyemi',
            relationship: RelationshipType.SPOUSE,
            phone: '+2348034567890',
          }),
        ).rejects.toMatchObject({
          response: { code: CONTACT_ALREADY_REGISTERED_CODE },
        });
      });

      it('rejects when member exceeds 10 adds per day rate limit', async () => {
        const rateLimiter = (
          service as unknown as { relativeRateLimiter: RelativeRateLimiter }
        ).relativeRateLimiter;
        jest.spyOn(rateLimiter, 'tryConsumeAdd').mockReturnValue(false);

        await expect(
          service.addRelative('member-1', 'church-1', {
            firstName: 'Tunde',
            lastName: 'Adeyemi',
            relationship: RelationshipType.SPOUSE,
            email: 'tunde@example.com',
          }),
        ).rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
        });
      });

      it('creates relative and relationship in transaction with masked fields', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);

        const result = await service.addRelative('member-1', 'church-1', {
          firstName: 'Tunde',
          lastName: 'Adeyemi',
          relationship: RelationshipType.SPOUSE,
          email: '  Tunde@Example.COM  ',
          phone: '08034567890',
          gender: Gender.MALE,
          dateOfBirth: '1990-04-02',
        });

        expect(result).toMatchObject({
          relationshipId: 'rel-1',
          person: {
            id: 'relative-1',
            firstName: 'Tunde',
            lastName: 'Adeyemi',
          },
          relationship: RelationshipType.SPOUSE,
          relationshipNote: null,
          addedByMe: true,
          claimed: false,
          maskedEmail: 't***@example.com',
          maskedPhone: '•••• ••• 7890',
          canSendClaimLink: true,
          canSendInviteEmail: true,
          inviteEmailSent: true,
        });
      });

      it('sends a claim email immediately when the relative has an email', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);

        await service.addRelative('member-1', 'church-1', {
          firstName: 'Tunde',
          lastName: 'Adeyemi',
          relationship: RelationshipType.SPOUSE,
          email: 'tunde@example.com',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledTimes(1);
        expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledWith(
          expect.objectContaining({
            recipientEmail: 'tunde@example.com',
            personId: 'relative-1',
            emailType: 'MAGIC_LINK',
            ctaUrl: expect.stringMatching(/\/[0-9a-f]{64}$/),
          }),
        );
      });

      it('does not send an email when the relative has only a phone', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);

        await service.addRelative('member-1', 'church-1', {
          firstName: 'Tunde',
          lastName: 'Adeyemi',
          relationship: RelationshipType.SPOUSE,
          phone: '08034567890',
        });
        await new Promise((resolve) => setImmediate(resolve));

        expect(emailProviderMock.sendCustomBroadcast).not.toHaveBeenCalled();
      });

      it('maps Prisma P2002 conflict to CONTACT_ALREADY_REGISTERED', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);
        prismaMock.$transaction.mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: '5.0.0',
          }),
        );

        await expect(
          service.addRelative('member-1', 'church-1', {
            firstName: 'Tunde',
            lastName: 'Adeyemi',
            relationship: RelationshipType.SPOUSE,
            email: 'conflict@example.com',
          }),
        ).rejects.toMatchObject({
          response: { code: CONTACT_ALREADY_REGISTERED_CODE },
        });
      });
    });

    describe('listMyRelatives', () => {
      it('lists incoming and outgoing relatives with correct inverted relationship types', async () => {
        prismaMock.personRelationship.findMany.mockResolvedValue([
          {
            id: 'rel-1',
            personId: 'member-1',
            relatedPersonId: 'relative-1',
            type: RelationshipType.CHILD,
            note: null,
            createdByPersonId: 'member-1',
            person: {
              id: 'member-1',
              firstName: 'Member',
              lastName: 'One',
              email: 'm1@example.com',
              phone: '+2348011111111',
              pinHash: 'hash',
            },
            relatedPerson: {
              id: 'relative-1',
              firstName: 'Child',
              lastName: 'One',
              email: 'child@example.com',
              phone: '+2348022222222',
              pinHash: null,
            },
          },
          {
            id: 'rel-2',
            personId: 'parent-1',
            relatedPersonId: 'member-1',
            type: RelationshipType.CHILD, // parent-1 describes member-1 as CHILD, so to member-1, parent-1 is PARENT
            note: null,
            createdByPersonId: 'parent-1',
            person: {
              id: 'parent-1',
              firstName: 'Parent',
              lastName: 'One',
              email: null,
              phone: '+2348033333333',
              pinHash: 'hash',
            },
            relatedPerson: {
              id: 'member-1',
              firstName: 'Member',
              lastName: 'One',
              email: 'm1@example.com',
              phone: '+2348011111111',
              pinHash: 'hash',
            },
          },
        ]);

        const result = await service.listMyRelatives('member-1', 'church-1');
        expect(result.items).toHaveLength(2);

        // Outgoing: member-1 -> relative-1 (CHILD)
        expect(result.items[0]).toEqual({
          relationshipId: 'rel-1',
          person: { id: 'relative-1', firstName: 'Child', lastName: 'One' },
          relationship: RelationshipType.CHILD,
          relationshipNote: null,
          addedByMe: true,
          claimed: false,
          maskedEmail: 'c***@example.com',
          maskedPhone: '•••• ••• 2222',
          canSendClaimLink: true,
          canSendInviteEmail: true,
        });

        // Incoming: parent-1 -> member-1 (CHILD inverted to PARENT)
        expect(result.items[1]).toEqual({
          relationshipId: 'rel-2',
          person: { id: 'parent-1', firstName: 'Parent', lastName: 'One' },
          relationship: RelationshipType.PARENT,
          relationshipNote: null,
          addedByMe: false,
          claimed: true,
          maskedEmail: null,
          maskedPhone: '•••• ••• 3333',
          canSendClaimLink: false,
          canSendInviteEmail: false,
        });
      });
    });

    describe('deleteMyRelative', () => {
      it('throws NotFoundException if relationship does not exist or wrong church', async () => {
        prismaMock.personRelationship.findUnique.mockResolvedValue(null);
        await expect(
          service.deleteMyRelative('member-1', 'church-1', 'rel-1'),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws ForbiddenException if member is neither person nor relatedPerson', async () => {
        prismaMock.personRelationship.findUnique.mockResolvedValue({
          id: 'rel-1',
          churchId: 'church-1',
          personId: 'someone-else',
          relatedPersonId: 'third-party',
        });

        await expect(
          service.deleteMyRelative('member-1', 'church-1', 'rel-1'),
        ).rejects.toThrow(ForbiddenException);
      });

      it('deletes relationship when member is personId', async () => {
        prismaMock.personRelationship.findUnique.mockResolvedValue({
          id: 'rel-1',
          churchId: 'church-1',
          personId: 'member-1',
          relatedPersonId: 'relative-1',
        });
        prismaMock.personRelationship.delete.mockResolvedValue({});

        const res = await service.deleteMyRelative(
          'member-1',
          'church-1',
          'rel-1',
        );
        expect(res.message).toBe('Relationship removed successfully');
        expect(prismaMock.personRelationship.delete).toHaveBeenCalledWith({
          where: { id: 'rel-1' },
        });
      });

      it('deletes relationship when member is relatedPersonId', async () => {
        prismaMock.personRelationship.findUnique.mockResolvedValue({
          id: 'rel-1',
          churchId: 'church-1',
          personId: 'relative-1',
          relatedPersonId: 'member-1',
        });
        prismaMock.personRelationship.delete.mockResolvedValue({});

        const res = await service.deleteMyRelative(
          'member-1',
          'church-1',
          'rel-1',
        );
        expect(res.message).toBe('Relationship removed successfully');
        expect(prismaMock.personRelationship.delete).toHaveBeenCalledWith({
          where: { id: 'rel-1' },
        });
      });
    });

    describe('resendRelativeInviteEmail', () => {
      const unclaimed = {
        id: 'rel-p-1',
        firstName: 'Tunde',
        lastName: 'Adeyemi',
        email: 'tunde@example.com',
        pinHash: null,
      };

      it('throws NotFoundException if person not found', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'x'),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws NOT_CREATOR if member did not create the relationship', async () => {
        prismaMock.person.findFirst.mockResolvedValue(unclaimed);
        prismaMock.personRelationship.findFirst.mockResolvedValue(null);
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({ response: { code: 'NOT_CREATOR' } });
      });

      it('throws ALREADY_CLAIMED if person has a pin', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          ...unclaimed,
          pinHash: 'hash',
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({ id: 'r' });
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({ response: { code: 'ALREADY_CLAIMED' } });
      });

      it('throws NO_EMAIL if person has no email', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          ...unclaimed,
          email: null,
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({ id: 'r' });
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({ response: { code: 'NO_EMAIL' } });
      });

      it('throws 429 when the daily invite email limit is exceeded', async () => {
        prismaMock.person.findFirst.mockResolvedValue(unclaimed);
        prismaMock.personRelationship.findFirst.mockResolvedValue({ id: 'r' });
        const rateLimiter = (
          service as unknown as { relativeRateLimiter: RelativeRateLimiter }
        ).relativeRateLimiter;
        jest.spyOn(rateLimiter, 'tryConsumeInviteEmail').mockReturnValue(false);
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      });

      it('issues a fresh token and sends the email', async () => {
        prismaMock.person.findFirst.mockResolvedValue(unclaimed);
        prismaMock.personRelationship.findFirst.mockResolvedValue({ id: 'r' });
        prismaMock.person.findUnique.mockResolvedValue({ firstName: 'Ada' });
        prismaMock.church.findUnique.mockResolvedValue({
          id: 'church-1',
          name: 'Amazing Grace',
        });
        prismaMock.person.update.mockResolvedValue({});

        const res = await service.resendRelativeInviteEmail(
          'member-1',
          'church-1',
          'rel-p-1',
        );

        expect(prismaMock.person.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'rel-p-1' },
            data: expect.objectContaining({
              profileToken: expect.stringMatching(/^[0-9a-f]{64}$/),
              profileTokenOpenedAt: null,
            }),
          }),
        );
        expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledWith(
          expect.objectContaining({ recipientEmail: 'tunde@example.com' }),
        );
        expect(res).toMatchObject({
          sent: true,
          maskedEmail: 't***@example.com',
        });
      });

      it('throws 503 EMAIL_SEND_FAILED when the provider fails', async () => {
        prismaMock.person.findFirst.mockResolvedValue(unclaimed);
        prismaMock.personRelationship.findFirst.mockResolvedValue({ id: 'r' });
        prismaMock.person.findUnique.mockResolvedValue({ firstName: 'Ada' });
        prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
        prismaMock.person.update.mockResolvedValue({});
        emailProviderMock.sendCustomBroadcast.mockRejectedValueOnce(
          new Error('boom'),
        );
        await expect(
          service.resendRelativeInviteEmail('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({ response: { code: 'EMAIL_SEND_FAILED' } });
      });
    });

    describe('createRelativeClaimLink', () => {
      it('throws NotFoundException if person not found', async () => {
        prismaMock.person.findFirst.mockResolvedValue(null);
        await expect(
          service.createRelativeClaimLink(
            'member-1',
            'church-1',
            'non-existent',
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('throws ForbiddenException (NOT_CREATOR) if member did not create the relationship', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          id: 'rel-p-1',
          firstName: 'Relative',
          phone: '+2348012345678',
          pinHash: null,
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue(null);

        await expect(
          service.createRelativeClaimLink('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({
          response: { code: 'NOT_CREATOR' },
        });
      });

      it('throws ConflictException (ALREADY_CLAIMED) if person has pinHash', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          id: 'rel-p-1',
          firstName: 'Relative',
          phone: '+2348012345678',
          pinHash: 'hashed-pin',
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({
          id: 'rel-1',
          createdByPersonId: 'member-1',
        });

        await expect(
          service.createRelativeClaimLink('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({
          response: { code: 'ALREADY_CLAIMED' },
        });
      });

      it('throws ConflictException (NO_PHONE) if person has no phone', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          id: 'rel-p-1',
          firstName: 'Relative',
          phone: null,
          pinHash: null,
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({
          id: 'rel-1',
          createdByPersonId: 'member-1',
        });

        await expect(
          service.createRelativeClaimLink('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({
          response: { code: 'NO_PHONE' },
        });
      });

      it('throws 429 when rate limit of 3 per day is exceeded', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          id: 'rel-p-1',
          firstName: 'Relative',
          phone: '+2348012345678',
          pinHash: null,
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({
          id: 'rel-1',
          createdByPersonId: 'member-1',
        });

        const rateLimiter = (
          service as unknown as { relativeRateLimiter: RelativeRateLimiter }
        ).relativeRateLimiter;
        jest.spyOn(rateLimiter, 'tryConsumeClaimLink').mockReturnValue(false);

        await expect(
          service.createRelativeClaimLink('member-1', 'church-1', 'rel-p-1'),
        ).rejects.toMatchObject({
          status: HttpStatus.TOO_MANY_REQUESTS,
        });
      });

      it('generates 48-hour claim link and wa.me url successfully', async () => {
        prismaMock.person.findFirst.mockResolvedValue({
          id: 'rel-p-1',
          firstName: 'Tunde',
          lastName: 'Adeyemi',
          phone: '+2348034567890',
          pinHash: null,
        });
        prismaMock.personRelationship.findFirst.mockResolvedValue({
          id: 'rel-1',
          createdByPersonId: 'member-1',
        });
        prismaMock.person.findUnique.mockResolvedValue({
          id: 'member-1',
          firstName: 'Ada',
        });
        prismaMock.church.findUnique.mockResolvedValue({
          id: 'church-1',
          name: 'Amazing Grace',
          shortName: 'Amazing Grace',
        });
        prismaMock.person.update.mockResolvedValue({});

        const res = await service.createRelativeClaimLink(
          'member-1',
          'church-1',
          'rel-p-1',
        );

        expect(res.url).toMatch(
          /^https:\/\/app\.abwog\.org\/profile\/[a-f0-9]{64}$/,
        );
        expect(res.whatsappUrl).toContain('https://wa.me/2348034567890?text=');
        expect(res.whatsappUrl).toContain(
          encodeURIComponent(
            "Hi Tunde, it's Ada. I've added you to Amazing Grace",
          ),
        );
        expect(res.expiresAt).toBeDefined();

        expect(prismaMock.person.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'rel-p-1' },
            data: expect.objectContaining({
              profileToken: expect.any(String),
              profileTokenExpiresAt: expect.any(Date),
              profileTokenOpenedAt: null,
            }),
          }),
        );
      });
    });
  });
});
