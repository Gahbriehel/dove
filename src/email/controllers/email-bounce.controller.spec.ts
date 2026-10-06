import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_SERVICE } from '../interfaces/email-service.interface';
import { EmailBounceController } from './email-bounce.controller';

describe('EmailBounceController', () => {
  let controller: EmailBounceController;

  const mockPrismaService = {
    emailBounce: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emailSendLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEmailService = {
    sendRegistrationConfirmation: jest.fn(),
    sendAdminWelcome: jest.fn(),
    sendCustomBroadcast: jest.fn(),
    sendBounceAdminAlert: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailBounceController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EMAIL_SERVICE,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    controller = module.get<EmailBounceController>(EmailBounceController);
    jest.clearAllMocks();
  });

  describe('getAnalytics', () => {
    it('should calculate email bounce analytics correctly', async () => {
      const churchId = 'church-123';
      const sendLogsMock = [
        {
          id: 'log-1',
          emailType: 'REGISTRATION_CONFIRMATION',
          createdAt: new Date('2026-05-10T10:00:00Z'),
        },
        {
          id: 'log-2',
          emailType: 'REGISTRATION_CONFIRMATION',
          createdAt: new Date('2026-05-11T10:00:00Z'),
        },
        {
          id: 'log-3',
          emailType: 'CUSTOM_BROADCAST',
          createdAt: new Date('2026-06-01T10:00:00Z'),
        },
        {
          id: 'log-4',
          emailType: 'ADMIN_WELCOME',
          createdAt: new Date('2026-06-02T10:00:00Z'),
        },
      ];

      const bouncesMock = [
        {
          id: 'b-1',
          email: 'bad1@gmail.com',
          eventType: 'email.bounced',
          bounceType: 'Hard',
          emailType: 'REGISTRATION_CONFIRMATION',
          recipientType: 'PERSON',
          isResolved: true,
          createdAt: new Date('2026-05-10T10:05:00Z'),
        },
        {
          id: 'b-2',
          email: 'bad2@yahoo.com',
          eventType: 'email.bounced',
          bounceType: 'Soft',
          emailType: 'CUSTOM_BROADCAST',
          recipientType: 'PERSON',
          isResolved: false,
          createdAt: new Date('2026-06-01T10:05:00Z'),
        },
      ];

      mockPrismaService.emailSendLog.findMany.mockResolvedValue(sendLogsMock);
      mockPrismaService.emailBounce.findMany.mockResolvedValue(bouncesMock);

      const result = await controller.getAnalytics(churchId, { year: 2026 });

      expect(result.year).toBe(2026);
      expect(result.summary.totalSent).toBe(4);
      expect(result.summary.totalBounces).toBe(2);
      expect(result.summary.resolvedBounces).toBe(1);
      expect(result.summary.unresolvedBounces).toBe(1);
      expect(result.summary.bounceRate).toBe(50);
      expect(result.summary.resolutionRate).toBe(50);
      expect(result.summary.deliveryRate).toBe(50);

      expect(result.byEventType).toEqual([
        { category: 'email.bounced', count: 2, percentage: 100 },
      ]);
      expect(result.byBounceType).toEqual([
        { category: 'Hard', count: 1, percentage: 50 },
        { category: 'Soft', count: 1, percentage: 50 },
      ]);
      expect(result.topFailingDomains).toEqual([
        { domain: 'gmail.com', count: 1 },
        { domain: 'yahoo.com', count: 1 },
      ]);

      const mayStat = result.monthlyTrend.find((m) => m.month === 5);
      expect(mayStat?.sentCount).toBe(2);
      expect(mayStat?.bounceCount).toBe(1);
      expect(mayStat?.resolvedCount).toBe(1);
    });

    it('should handle zero sent and zero bounce gracefully without division by zero', async () => {
      const churchId = 'church-123';
      mockPrismaService.emailSendLog.findMany.mockResolvedValue([]);
      mockPrismaService.emailBounce.findMany.mockResolvedValue([]);

      const result = await controller.getAnalytics(churchId, { year: 2026 });

      expect(result.summary.totalSent).toBe(0);
      expect(result.summary.totalBounces).toBe(0);
      expect(result.summary.bounceRate).toBe(0);
      expect(result.summary.resolutionRate).toBe(0);
      expect(result.summary.deliveryRate).toBe(100);
      expect(result.byEventType).toEqual([]);
      expect(result.topFailingDomains).toEqual([]);
    });
  });

  describe('getUnresolvedBounces', () => {
    it('should query unresolved bounces for church', async () => {
      const churchId = 'church-123';
      const mockList = [
        { id: 'b-1', email: 'test@example.com', isResolved: false },
      ];
      mockPrismaService.emailBounce.findMany.mockResolvedValue(mockList);

      const result = await controller.getUnresolvedBounces(churchId);
      expect(mockPrismaService.emailBounce.findMany).toHaveBeenCalledWith({
        where: { churchId, isResolved: false },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toBe(mockList);
    });
  });
});
