/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { MemberSessionService } from '../profile/member-session.service';
import { PushService } from './push.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

describe('PushService', () => {
  let service: PushService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    pushSubscription: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    notificationLog: {
      findMany: jest.Mock;
    };
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let jwtServiceMock: {
    verifyAsync: jest.Mock;
  };
  let sessionServiceMock: {
    isRevoked: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      pushSubscription: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      notificationLog: {
        findMany: jest.fn(),
      },
    };

    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'push.vapidPublicKey') return 'mock-pub';
        if (key === 'push.vapidPrivateKey') return 'mock-priv';
        if (key === 'push.vapidSubject') return 'mailto:info@abwog.org';
        if (key === 'jwt.secret') return 'jwt-secret';
        return undefined;
      }),
    };

    jwtServiceMock = {
      verifyAsync: jest.fn(),
    };

    sessionServiceMock = {
      isRevoked: jest.fn().mockReturnValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: MemberSessionService, useValue: sessionServiceMock },
      ],
    }).compile();

    service = module.get<PushService>(PushService);
  });

  describe('subscribe', () => {
    it('is idempotent per endpoint and saves anonymous subscription', async () => {
      prismaMock.pushSubscription.upsert.mockResolvedValue({});

      const dto = {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
          keys: {
            p256dh: 'p256-key',
            auth: 'auth-key',
          },
        },
        topics: ['night-prayer', 'scriptures'] as any,
      };

      const result = await service.subscribe(dto);
      expect(result.subscribed).toBe(true);
      expect(result.topics).toEqual(['night-prayer', 'scriptures']);
      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1' },
          create: expect.objectContaining({
            endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
            personId: null,
            topics: ['night-prayer', 'scriptures'],
          }),
        }),
      );
    });

    it('links personId when valid member session token is provided', async () => {
      jwtServiceMock.verifyAsync.mockResolvedValue({
        sub: 'person-123',
        type: 'MEMBER',
        aud: 'dove:member',
        churchId: 'church-1',
        jti: 'jti-1',
      });
      sessionServiceMock.isRevoked.mockReturnValue(false);
      prismaMock.pushSubscription.upsert.mockResolvedValue({});

      const dto = {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-member',
          keys: {
            p256dh: 'p256-key',
            auth: 'auth-key',
          },
        },
        memberToken: 'valid.member.jwt',
      };

      const result = await service.subscribe(dto);
      expect(result.subscribed).toBe(true);
      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            personId: 'person-123',
          }),
        }),
      );
    });

    it('proceeds with personId null when member token is invalid or expired', async () => {
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('Token expired'));
      prismaMock.pushSubscription.upsert.mockResolvedValue({});

      const dto = {
        subscription: {
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-anon',
          keys: {
            p256dh: 'p256-key',
            auth: 'auth-key',
          },
        },
        memberToken: 'expired.token',
      };

      const result = await service.subscribe(dto);
      expect(result.subscribed).toBe(true);
      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            personId: null,
          }),
        }),
      );
    });
  });

  describe('unsubscribe', () => {
    it('deletes the subscription idempotently', async () => {
      prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.unsubscribe({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      });
      expect(result.unsubscribed).toBe(true);
      expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: 'https://fcm.googleapis.com/fcm/send/device-1' },
      });
    });
  });

  describe('updateTopics', () => {
    it('updates topics for existing subscription', async () => {
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      });
      prismaMock.pushSubscription.update.mockResolvedValue({});

      const result = await service.updateTopics({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
        topics: ['confessions', 'encouragement'] as any,
      });

      expect(result.updated).toBe(true);
      expect(result.topics).toEqual(['confessions', 'encouragement']);
      expect(prismaMock.pushSubscription.update).toHaveBeenCalled();
    });

    it('throws NotFoundException when subscription does not exist', async () => {
      prismaMock.pushSubscription.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTopics({
          endpoint: 'https://unknown.com',
          topics: ['night-prayer'] as any,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('testSelf rate limiting', () => {
    it('sends test push to existing device', async () => {
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-test',
        p256dh: 'p',
        auth: 'a',
        failureCount: 0,
      });
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      const result = await service.testSelf({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-test',
      });

      expect(result.sent).toBe(true);
      expect(webpush.sendNotification).toHaveBeenCalled();
    });

    it('allows at most 3 test sends per hour per endpoint', async () => {
      prismaMock.pushSubscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-limit',
        p256dh: 'p',
        auth: 'a',
        failureCount: 0,
      });
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});

      // 1st, 2nd, 3rd call succeed
      await service.testSelf({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-limit',
      });
      await service.testSelf({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-limit',
      });
      await service.testSelf({
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-limit',
      });

      // 4th call should throw 429 Too Many Requests
      await expect(
        service.testSelf({
          endpoint: 'https://fcm.googleapis.com/fcm/send/device-limit',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('Web Push error handling', () => {
    const sub = {
      id: 'sub-error',
      churchId: 'church-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/error',
      p256dh: 'p',
      auth: 'a',
      failureCount: 0,
      topics: ['night-prayer'],
      personId: null,
      userAgent: null,
      createdAt: new Date(),
      lastSeenAt: new Date(),
    };

    const payload = {
      title: 'Night Prayer',
      body: 'Tap to join.',
      url: '/',
      tag: 'night-prayer',
      topic: 'night-prayer',
    };

    it('410 or 404 deletes the subscription immediately', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 410,
        message: 'Gone',
      });
      prismaMock.pushSubscription.delete.mockResolvedValue({});

      const sent = await service.sendToSubscription(sub, payload);
      expect(sent).toBe(false);
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-error' },
      });
    });

    it('5 consecutive other failures delete the subscription', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 500,
        message: 'Internal server error',
      });
      prismaMock.pushSubscription.delete.mockResolvedValue({});

      // Sub has 4 prior failures; next failure reaches 5
      const failingSub = { ...sub, failureCount: 4 };

      const sent = await service.sendToSubscription(failingSub, payload);
      expect(sent).toBe(false);
      expect(prismaMock.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-error' },
      });
    });

    it('failure count is incremented on non-404/410 errors when below 5', async () => {
      (webpush.sendNotification as jest.Mock).mockRejectedValue({
        statusCode: 502,
        message: 'Bad Gateway',
      });
      prismaMock.pushSubscription.update.mockResolvedValue({});

      const failingSub = { ...sub, failureCount: 2 };
      const sent = await service.sendToSubscription(failingSub, payload);
      expect(sent).toBe(false);
      expect(prismaMock.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-error' },
        data: { failureCount: { increment: 1 } },
      });
    });

    it('success resets failureCount to 0', async () => {
      (webpush.sendNotification as jest.Mock).mockResolvedValue({});
      prismaMock.pushSubscription.update.mockResolvedValue({});

      const failingSub = { ...sub, failureCount: 2 };
      const sent = await service.sendToSubscription(failingSub, payload);
      expect(sent).toBe(true);
      expect(prismaMock.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-error' },
        data: { failureCount: 0 },
      });
    });
  });

  describe('getLog', () => {
    it('returns logs and subscriber counts broken down by topic', async () => {
      prismaMock.notificationLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          key: 'night-prayer:2026-11-08:0',
          title: 'Night Prayer is starting',
        },
      ]);
      prismaMock.pushSubscription.findMany.mockResolvedValue([
        { topics: ['night-prayer', 'confessions'] },
        { topics: ['night-prayer', 'scriptures', 'encouragement'] },
      ]);

      const result = await service.getLog('church-1');
      expect(result.logs).toHaveLength(1);
      expect(result.subscribers.total).toBe(2);
      expect(result.subscribers.byTopic['night-prayer']).toBe(2);
      expect(result.subscribers.byTopic['confessions']).toBe(1);
      expect(result.subscribers.byTopic['scriptures']).toBe(1);
      expect(result.subscribers.byTopic['encouragement']).toBe(1);
    });
  });
});
