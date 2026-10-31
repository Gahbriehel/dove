import { verifyUnsubscribeToken } from './utils/unsubscribe-token.util';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { MembershipStatus, RegistrationStatus } from '@prisma/client';

describe('EmailService', () => {
  let service: EmailService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    person: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    registration: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    emailSendLog: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
    emailBounce: {
      findMany: jest.Mock;
    };
  };
  let configMock: {
    get: jest.Mock;
  };
  let emailProviderMock: {
    sendRegistrationConfirmation: jest.Mock;
    sendAdminWelcome: jest.Mock;
    sendCustomBroadcast: jest.Mock;
    sendBatchCustomBroadcast: jest.Mock;
    sendBounceAdminAlert: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      person: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      registration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      emailSendLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
      emailBounce: {
        findMany: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'appUrl') return 'http://localhost:3000';
        if (key === 'jwt.secret') return 'test-secret';
        return undefined;
      }),
    };

    emailProviderMock = {
      sendRegistrationConfirmation: jest.fn().mockResolvedValue(undefined),
      sendAdminWelcome: jest.fn().mockResolvedValue(undefined),
      sendCustomBroadcast: jest.fn().mockResolvedValue(undefined),
      sendBatchCustomBroadcast: jest.fn().mockResolvedValue({
        totalTargeted: 1,
        totalWithEmail: 1,
        totalSent: 1,
        totalFailed: 0,
        failedRecipients: [],
      }),
      sendBounceAdminAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
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

    service = module.get<EmailService>(EmailService);
  });

  describe('sendToRegistrantsBatch', () => {
    const mockRegistration = {
      id: 'reg-1',
      token: 'token-xyz',
      registrationNumber: 'REG-1001',
      status: RegistrationStatus.CONFIRMED,
      person: {
        id: 'person-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      },
      event: {
        id: 'event-1',
        title: 'Youth Retreat',
        startDate: new Date('2026-10-01T10:00:00Z'),
        church: { name: 'Grace Church', email: 'info@grace.org' },
        imageUrl: '/public/uploads/event-flyer.png',
      },
      team: null,
    };

    it('should resolve relative imageUrl to absolute appUrl and dispatch batch email', async () => {
      prismaMock.registration.findMany.mockResolvedValue([mockRegistration]);

      const result = await service.sendToRegistrantsBatch({
        eventId: 'event-1',
        subject: 'Reminder: {{eventTitle}}',
        message: 'Hello {{firstName}}, see you there!',
        imageUrl: '/public/uploads/custom-flyer.png',
      });

      expect(prismaMock.registration.findMany).toHaveBeenCalled();
      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'john.doe@example.com',
          subject: 'Reminder: Youth Retreat',
          message: 'Hello John, see you there!',
          imageUrl: 'http://localhost:3000/public/uploads/custom-flyer.png',
        }),
      ]);
      expect(result.results.totalSent).toBe(1);
    });

    it('should keep external https:// imageUrl as is without prepending appUrl', async () => {
      prismaMock.registration.findMany.mockResolvedValue([mockRegistration]);

      await service.sendToRegistrantsBatch({
        eventId: 'event-1',
        subject: 'Notice',
        message: 'Hello!',
        imageUrl: 'https://cdn.example.com/hosted-flyer.png',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          imageUrl: 'https://cdn.example.com/hosted-flyer.png',
        }),
      ]);
    });

    it('should set imageUrl to undefined when omitted (no fallback to event.imageUrl)', async () => {
      prismaMock.registration.findMany.mockResolvedValue([mockRegistration]);

      await service.sendToRegistrantsBatch({
        eventId: 'event-1',
        subject: 'Notice',
        message: 'Hello!',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          imageUrl: undefined,
        }),
      ]);
    });
  });

  describe('sendToPeopleBatch', () => {
    const mockPerson1 = {
      id: 'person-1',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      phone: '+15551234567',
      church: {
        name: 'Dove Church',
        email: 'office@dove.church',
        phone: '+15550001111',
      },
    };

    const mockPerson2 = {
      id: 'person-2',
      firstName: 'Bob',
      lastName: 'Jones',
      email: 'bob.jones@example.com',
      phone: '+15559876543',
      church: {
        name: 'Dove Church',
        email: 'office@dove.church',
        phone: '+15550001111',
      },
    };

    it('should resolve relative imageUrl to absolute appUrl and dispatch batch email to people', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1]);

      const result = await service.sendToPeopleBatch({
        personIds: ['person-1'],
        subject: 'Special Announcement for {{firstName}}',
        message: '<p>Hello {{firstName}}, review the flyer below.</p>',
        imageUrl: '/public/uploads/flyer-relative.png',
        ctaLabel: 'Read More',
        ctaUrl: 'https://example.org/news',
      });

      expect(prismaMock.person.findMany).toHaveBeenCalledWith({
        where: {
          churchId: 'church-1',
          id: { in: ['person-1'] },
        },
        include: { church: true },
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'alice.smith@example.com',
          recipientName: 'Alice Smith',
          subject: 'Special Announcement for Alice',
          message: '<p>Hello Alice, review the flyer below.</p>',
          imageUrl: 'http://localhost:3000/public/uploads/flyer-relative.png',
          ctaLabel: 'Read More',
          ctaUrl: 'https://example.org/news',
        }),
      ]);

      expect(result.results.totalSent).toBe(1);
    });

    it('should keep external https:// imageUrl as is without prepending appUrl for people batch', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1, mockPerson2]);

      const result = await service.sendToPeopleBatch({
        personIds: ['person-1', 'person-2'],
        subject: 'Weekly Fellowship Announcement',
        heading: 'Welcome to Sunday Service',
        message: '<p>Join us this Sunday. Check out the flyer below!</p>',
        imageUrl:
          'https://api.abwog.org/public/uploads/1792601056334-762496662.jpg',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'alice.smith@example.com',
          imageUrl:
            'https://api.abwog.org/public/uploads/1792601056334-762496662.jpg',
        }),
        expect.objectContaining({
          recipientEmail: 'bob.jones@example.com',
          imageUrl:
            'https://api.abwog.org/public/uploads/1792601056334-762496662.jpg',
        }),
      ]);

      expect(result.message).toContain('Batch email processing completed');
    });

    it('should attach a verifiable unsubscribe URL to each people batch email', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1]);

      await service.sendToPeopleBatch({
        personIds: ['person-1'],
        subject: 'Announcement',
        message: '<p>Hello</p>',
      });

      const [[items]] = emailProviderMock.sendBatchCustomBroadcast.mock
        .calls as [[Array<{ unsubscribeUrl?: string }>]];
      const prefix = 'http://localhost:3000/api/v1/email/unsubscribe/';
      expect(items[0].unsubscribeUrl).toContain(prefix);

      const token = decodeURIComponent(
        items[0].unsubscribeUrl!.slice(prefix.length),
      );
      expect(verifyUnsubscribeToken(token, 'test-secret')).toBe('person-1');
    });

    it('should skip opted-out people and report how many were skipped', async () => {
      prismaMock.person.findMany.mockResolvedValue([
        mockPerson1,
        { ...mockPerson2, emailOptOut: true },
      ]);

      const result = await service.sendToPeopleBatch({
        personIds: ['person-1', 'person-2'],
        subject: 'Announcement',
        message: '<p>Hello</p>',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({ recipientEmail: 'alice.smith@example.com' }),
      ]);
      expect(result.results.totalOptedOut).toBe(1);
      expect(result.message).toContain('1 skipped (unsubscribed)');
    });

    it('should set imageUrl to undefined when omitted or whitespace in people batch', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1]);

      await service.sendToPeopleBatch({
        personIds: ['person-1'],
        subject: 'Community Reminder',
        heading: 'Upcoming Prayer Meeting',
        message: "<p>Don't forget our prayer meeting tomorrow at 7 PM.</p>",
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'alice.smith@example.com',
          imageUrl: undefined,
        }),
      ]);
    });

    it('should handle empty string imageUrl by setting imageUrl to undefined', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1]);

      await service.sendToPeopleBatch({
        personIds: ['person-1'],
        subject: 'Community Reminder',
        message: '<p>Simple reminder.</p>',
        imageUrl: '   ',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'alice.smith@example.com',
          imageUrl: undefined,
        }),
      ]);
    });

    it('should filter by membershipStatus and search when provided', async () => {
      prismaMock.person.findMany.mockResolvedValue([mockPerson1]);

      await service.sendToPeopleBatch({
        membershipStatus: MembershipStatus.MEMBER,
        search: 'Alice',
        subject: 'Members Notice',
        message: 'Dear member...',
      });

      expect(prismaMock.person.findMany).toHaveBeenCalledWith({
        where: {
          churchId: 'church-1',
          membershipStatus: 'MEMBER',
          OR: [
            { firstName: { contains: 'Alice' } },
            { lastName: { contains: 'Alice' } },
            { email: { contains: 'Alice' } },
            { phone: { contains: 'Alice' } },
          ],
        },
        include: { church: true },
      });
    });

    it('should skip people without valid email addresses', async () => {
      const personWithoutEmail = {
        id: 'person-no-email',
        firstName: 'No',
        lastName: 'Email',
        email: '',
        church: { name: 'Dove Church' },
      };

      prismaMock.person.findMany.mockResolvedValue([
        mockPerson1,
        personWithoutEmail,
      ]);

      await service.sendToPeopleBatch({
        subject: 'Test',
        message: 'Hello',
      });

      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith([
        expect.objectContaining({
          recipientEmail: 'alice.smith@example.com',
        }),
      ]);
      expect(emailProviderMock.sendBatchCustomBroadcast).toHaveBeenCalledWith(
        expect.arrayContaining([expect.anything()]),
      );
    });

    it('should throw BadRequestException when no people match criteria', async () => {
      prismaMock.person.findMany.mockResolvedValue([]);

      await expect(
        service.sendToPeopleBatch({
          personIds: ['non-existent-id'],
          subject: 'Test',
          message: 'Hello',
        }),
      ).rejects.toThrow(
        'No matching people found for the specified filter criteria.',
      );
    });
  });

  describe('getEmailLogs', () => {
    it('should return paginated email logs with populated recipients and delivery status', async () => {
      const mockLog = {
        id: 'log-1',
        resendEmailId: 'resend-1',
        emailType: 'CUSTOM_BROADCAST',
        churchId: 'church-1',
        recipientEmail: 'sarah@example.com',
        recipientName: 'Sarah Connor',
        subject: 'Weekly Digest',
        personId: 'person-1',
        userId: null,
        registrationId: null,
        broadcastContent: {
          subject: 'Weekly Digest',
          message: 'Here is your weekly update.',
        },
        createdAt: new Date('2026-10-09T10:00:00Z'),
      };

      prismaMock.emailSendLog.count.mockResolvedValue(1);
      prismaMock.emailSendLog.findMany.mockResolvedValue([mockLog]);
      prismaMock.emailBounce.findMany.mockResolvedValue([]);

      const result = await service.getEmailLogs({ page: 1, limit: 10 });

      expect(prismaMock.emailSendLog.count).toHaveBeenCalled();
      expect(prismaMock.emailSendLog.findMany).toHaveBeenCalled();
      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'log-1',
        resendEmailId: 'resend-1',
        emailType: 'CUSTOM_BROADCAST',
        subject: 'Weekly Digest',
        recipient: {
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          type: 'PERSON',
        },
        deliveryStatus: 'DELIVERABLE',
      });
    });

    it('should flag deliveryStatus as BOUNCED when matching bounce record exists', async () => {
      const mockLog = {
        id: 'log-2',
        resendEmailId: 'resend-bounced',
        emailType: 'ADMIN_WELCOME',
        churchId: 'church-1',
        recipientEmail: 'bad@domain.invalid',
        recipientName: 'Bad Mailbox',
        subject: 'Admin Account Credentials',
        personId: null,
        userId: 'user-1',
        registrationId: null,
        broadcastContent: null,
        createdAt: new Date('2026-10-09T10:00:00Z'),
      };

      prismaMock.emailSendLog.count.mockResolvedValue(1);
      prismaMock.emailSendLog.findMany.mockResolvedValue([mockLog]);
      prismaMock.emailBounce.findMany.mockResolvedValue([
        {
          id: 'bounce-1',
          resendEmailId: 'resend-bounced',
          eventType: 'BOUNCED',
          reason: '550 User unknown',
        },
      ]);

      const result = await service.getEmailLogs({});

      expect(result.data[0].deliveryStatus).toBe('BOUNCED');
      expect(result.data[0].bounceReason).toBe('550 User unknown');
    });

    it('should hydrate missing recipient info using personId fallback', async () => {
      const mockLog = {
        id: 'log-3',
        resendEmailId: 'resend-legacy',
        emailType: 'CUSTOM_BROADCAST',
        churchId: 'church-1',
        recipientEmail: null,
        recipientName: null,
        subject: null,
        personId: 'person-99',
        userId: null,
        registrationId: null,
        broadcastContent: { message: 'Old broadcast format' },
        createdAt: new Date('2026-10-01T00:00:00Z'),
      };

      prismaMock.emailSendLog.count.mockResolvedValue(1);
      prismaMock.emailSendLog.findMany.mockResolvedValue([mockLog]);
      prismaMock.emailBounce.findMany.mockResolvedValue([]);
      prismaMock.person.findMany.mockResolvedValue([
        {
          id: 'person-99',
          firstName: 'Legacy',
          lastName: 'Member',
          email: 'legacy@example.com',
        },
      ]);

      const result = await service.getEmailLogs({});

      expect(result.data[0].recipient).toMatchObject({
        id: 'person-99',
        name: 'Legacy Member',
        email: 'legacy@example.com',
        type: 'PERSON',
      });
    });

    it('should hydrate sentBy admin user when sentByUserId is present', async () => {
      const mockLog = {
        id: 'log-4',
        resendEmailId: 'resend-admin-sent',
        emailType: 'CUSTOM_BROADCAST',
        churchId: 'church-1',
        recipientEmail: 'member@example.com',
        recipientName: 'Church Member',
        subject: 'Pastor Announcement',
        personId: 'person-1',
        userId: null,
        registrationId: null,
        sentByUserId: 'admin-user-77',
        broadcastContent: { message: 'Announcement body' },
        createdAt: new Date('2026-10-09T12:00:00Z'),
      };

      prismaMock.emailSendLog.count.mockResolvedValue(1);
      prismaMock.emailSendLog.findMany.mockResolvedValue([mockLog]);
      prismaMock.emailBounce.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'admin-user-77',
          firstName: 'Pastor',
          lastName: 'David',
          email: 'pastor.david@church.org',
        },
      ]);

      const result = await service.getEmailLogs({});

      expect(result.data[0].sentBy).toEqual({
        id: 'admin-user-77',
        name: 'Pastor David',
        email: 'pastor.david@church.org',
      });
    });
  });
});
