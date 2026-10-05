import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus, Prisma } from '@prisma/client';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { BirthdaysService } from './birthdays.service';
import { BirthdayStatusFilter } from './dto/query-birthday.dto';

describe('BirthdaysService', () => {
  let service: BirthdaysService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    person: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    birthdayGreeting: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };
  let configMock: {
    get: jest.Mock;
  };
  let emailProviderMock: {
    sendCustomBroadcast: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      person: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      birthdayGreeting: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'greeting-1' }),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'appUrl') return 'https://dove.church';
        return undefined;
      }),
    };

    emailProviderMock = {
      sendCustomBroadcast: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BirthdaysService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: ConfigService,
          useValue: configMock,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: emailProviderMock,
        },
      ],
    }).compile();

    service = module.get<BirthdaysService>(BirthdaysService);
  });

  describe('sendBirthdayGreeting', () => {
    const mockPerson = {
      id: 'person-1',
      churchId: 'church-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      dateOfBirth: new Date('1990-10-15T00:00:00.000Z'),
      church: {
        id: 'church-1',
        name: 'Dove Main Church',
        email: 'info@dove.church',
        phone: '+123456789',
      },
    };

    it('should successfully send a birthday greeting, create audit record, and resolve relative image URL', async () => {
      prismaMock.person.findFirst.mockResolvedValue(mockPerson);
      prismaMock.birthdayGreeting.findUnique.mockResolvedValue(null);

      const createdRecord = {
        id: 'greeting-1',
        churchId: 'church-1',
        personId: 'person-1',
        sentByUserId: 'admin-1',
        year: 2026,
        subject: 'Happy Birthday Jane! (36)',
        heading: 'Celebrating Jane Doe!',
        message: 'Wishing you grace and peace.',
        imageUrl: 'https://dove.church/public/uploads/card.png',
        ctaLabel: 'Visit Church',
        ctaUrl: 'https://dove.church',
        createdAt: new Date('2026-10-05T12:00:00.000Z'),
        sentBy: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@dove.church',
        },
      };
      prismaMock.birthdayGreeting.create.mockResolvedValue(createdRecord);

      const result = await service.sendBirthdayGreeting(
        {
          personId: 'person-1',
          year: 2026,
          subject: 'Happy Birthday {{firstName}}! ({{turningAge}})',
          heading: 'Celebrating {{fullName}}!',
          message: 'Wishing you grace and peace.',
          imageUrl: '/public/uploads/card.png',
          ctaLabel: 'Visit Church',
          ctaUrl: 'https://dove.church',
        },
        'admin-1',
        'church-1',
      );

      expect(prismaMock.person.findFirst).toHaveBeenCalledWith({
        where: { id: 'person-1', churchId: 'church-1' },
        include: { church: true },
      });
      expect(prismaMock.birthdayGreeting.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            churchId: 'church-1',
            personId: 'person-1',
            sentByUserId: 'admin-1',
            year: 2026,
            subject: 'Happy Birthday Jane! (36)',
            heading: 'Celebrating Jane Doe!',
            message: 'Wishing you grace and peace.',
            imageUrl: 'https://dove.church/public/uploads/card.png',
            ctaLabel: 'Visit Church',
            ctaUrl: 'https://dove.church',
          },
        }),
      );
      expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'jane.doe@example.com',
          recipientName: 'Jane Doe',
          subject: 'Happy Birthday Jane! (36)',
          imageUrl: 'https://dove.church/public/uploads/card.png',
          personId: 'person-1',
          userId: 'admin-1',
        }),
      );
      expect(result.message).toContain('Jane Doe');
      expect(result.greeting.sentBy.email).toBe('admin@dove.church');
    });

    it('should throw NotFoundException if person does not exist', async () => {
      prismaMock.person.findFirst.mockResolvedValue(null);

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'invalid-id',
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if person has no date of birth', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        ...mockPerson,
        dateOfBirth: null,
      });

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'person-1',
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if person has no valid email', async () => {
      prismaMock.person.findFirst.mockResolvedValue({
        ...mockPerson,
        email: '',
      });

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'person-1',
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if greeting was already sent for the cycle (duplicate outreach prevention)', async () => {
      prismaMock.person.findFirst.mockResolvedValue(mockPerson);
      prismaMock.birthdayGreeting.findUnique.mockResolvedValue({
        id: 'existing-greeting-id',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
        sentBy: {
          firstName: 'Pastor',
          lastName: 'Mark',
          email: 'pastor@dove.church',
        },
      });

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'person-1',
            year: 2026,
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should handle race condition (P2002 unique constraint) and throw ConflictException', async () => {
      prismaMock.person.findFirst.mockResolvedValue(mockPerson);
      prismaMock.birthdayGreeting.findUnique
        .mockResolvedValueOnce(null) // First check passes
        .mockResolvedValueOnce({
          // Second check inside P2002 catch retrieves concurrent record
          id: 'concurrent-greeting',
          sentBy: {
            firstName: 'Sarah',
            lastName: 'Admin',
          },
        });

      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        {
          code: 'P2002',
          clientVersion: '6.19.3',
        },
      );
      prismaMock.birthdayGreeting.create.mockRejectedValue(prismaError);

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'person-1',
            year: 2026,
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should rollback created greeting record if email sending fails', async () => {
      prismaMock.person.findFirst.mockResolvedValue(mockPerson);
      prismaMock.birthdayGreeting.findUnique.mockResolvedValue(null);
      prismaMock.birthdayGreeting.create.mockResolvedValue({
        id: 'greeting-to-rollback',
        sentBy: {
          id: 'admin-1',
          firstName: 'Admin',
          lastName: 'User',
          email: 'admin@dove.church',
        },
      });

      emailProviderMock.sendCustomBroadcast.mockRejectedValue(
        new Error('SMTP connection error'),
      );

      await expect(
        service.sendBirthdayGreeting(
          {
            personId: 'person-1',
            year: 2026,
            subject: 'Happy Birthday',
            message: 'Greetings',
          },
          'admin-1',
          'church-1',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.birthdayGreeting.delete).toHaveBeenCalledWith({
        where: { id: 'greeting-to-rollback' },
      });
    });
  });

  describe('getBirthdays', () => {
    it('should return categorized birthdays with status and greeting details', async () => {
      const mockPeople = [
        {
          id: 'p-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          phone: '111',
          membershipStatus: MembershipStatus.MEMBER,
          dateOfBirth: new Date('1990-10-15T00:00:00.000Z'),
        },
        {
          id: 'p-2',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          phone: '222',
          membershipStatus: MembershipStatus.VISITOR,
          dateOfBirth: new Date('1985-01-10T00:00:00.000Z'),
        },
      ];

      const mockGreetings = [
        {
          id: 'g-1',
          personId: 'p-1',
          year: 2026,
          subject: 'Happy Birthday Alice',
          heading: 'Celebrating You',
          message: 'Happy birthday!',
          imageUrl: null,
          ctaLabel: null,
          ctaUrl: null,
          createdAt: new Date('2026-10-05T08:00:00.000Z'),
          sentBy: {
            id: 'admin-1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@dove.church',
          },
        },
      ];

      prismaMock.person.findMany.mockResolvedValue(mockPeople);
      prismaMock.birthdayGreeting.findMany.mockResolvedValue(mockGreetings);

      const result = await service.getBirthdays(
        {
          year: 2026,
          status: BirthdayStatusFilter.ALL,
        },
        'church-1',
      );

      expect(result.total).toBe(2);
      const alice = result.data.find((p) => p.id === 'p-1');
      const bob = result.data.find((p) => p.id === 'p-2');

      expect(alice?.status).toBe('COMPLETED');
      expect(alice?.isGreeted).toBe(true);
      expect(alice?.greeting?.sentBy.firstName).toBe('Admin');

      expect(bob?.isGreeted).toBe(false);
      expect(bob?.greeting).toBeNull();
    });

    it('should filter by search and month correctly', async () => {
      const mockPeople = [
        {
          id: 'p-1',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          phone: '111',
          membershipStatus: MembershipStatus.MEMBER,
          dateOfBirth: new Date('1990-10-15T00:00:00.000Z'),
        },
        {
          id: 'p-2',
          firstName: 'Bob',
          lastName: 'Jones',
          email: 'bob@example.com',
          phone: '222',
          membershipStatus: MembershipStatus.VISITOR,
          dateOfBirth: new Date('1985-01-10T00:00:00.000Z'),
        },
      ];

      prismaMock.person.findMany.mockResolvedValue(mockPeople);
      prismaMock.birthdayGreeting.findMany.mockResolvedValue([]);

      const result = await service.getBirthdays(
        {
          year: 2026,
          month: 10,
          search: 'alice',
        },
        'church-1',
      );

      expect(result.total).toBe(1);
      expect(result.data[0].firstName).toBe('Alice');
    });
  });

  describe('getBirthdayAnalytics', () => {
    it('should accurately compute overall metrics and 12-month breakdown', async () => {
      const mockPeople = [
        { id: 'p-1', dateOfBirth: new Date('1990-01-05T00:00:00.000Z') }, // Past (Missed)
        { id: 'p-2', dateOfBirth: new Date('1992-01-20T00:00:00.000Z') }, // Past (Greeted)
        { id: 'p-3', dateOfBirth: new Date('1995-12-25T00:00:00.000Z') }, // Future (Pending)
        { id: 'p-4', dateOfBirth: new Date('1988-12-30T00:00:00.000Z') }, // Future (Greeted)
      ];

      const mockGreetings = [{ personId: 'p-2' }, { personId: 'p-4' }];

      prismaMock.person.findMany.mockResolvedValue(mockPeople);
      prismaMock.birthdayGreeting.findMany.mockResolvedValue(mockGreetings);

      const result = await service.getBirthdayAnalytics(
        { year: 2026 },
        'church-1',
      );

      expect(result.totalBirthdays).toBe(4);
      expect(result.completedCount).toBe(2);
      expect(result.handlingRate).toBe(50);
      expect(result.monthlyBreakdown.length).toBe(12);

      const janStat = result.monthlyBreakdown.find((m) => m.month === 1);
      expect(janStat?.total).toBe(2);
      expect(janStat?.completed).toBe(1);
      expect(janStat?.missed).toBe(1);
      expect(janStat?.handlingRate).toBe(50);

      const decStat = result.monthlyBreakdown.find((m) => m.month === 12);
      expect(decStat?.total).toBe(2);
      expect(decStat?.completed).toBe(1);
      expect(decStat?.pending).toBe(1);
      expect(decStat?.handlingRate).toBe(50);
    });
  });
});
