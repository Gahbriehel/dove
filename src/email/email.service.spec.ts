import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { RegistrationStatus } from '@prisma/client';

describe('EmailService', () => {
  let service: EmailService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    person: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
    registration: {
      findFirst: jest.Mock;
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
      registration: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    configMock = {
      get: jest.fn((key: string) => {
        if (key === 'appUrl') return 'http://localhost:3000';
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

  describe('sendToRegistrant', () => {
    it('should resolve relative imageUrl for single registrant email', async () => {
      prismaMock.registration.findFirst.mockResolvedValue({
        id: 'reg-1',
        token: 'token-xyz',
        registrationNumber: 'REG-1001',
        person: {
          id: 'person-1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
        event: {
          id: 'event-1',
          title: 'Sunday Service',
          startDate: new Date('2026-10-04T09:00:00Z'),
          church: { name: 'Grace Church' },
        },
        team: null,
      });

      await service.sendToRegistrant({
        registrationId: 'reg-1',
        subject: 'Welcome {{firstName}}',
        message: 'Welcome to church!',
        imageUrl: '/public/uploads/service.jpg',
      });

      expect(emailProviderMock.sendCustomBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientEmail: 'jane@example.com',
          imageUrl: 'http://localhost:3000/public/uploads/service.jpg',
        }),
      );
    });
  });
});
