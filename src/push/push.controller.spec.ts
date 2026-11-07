/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushTickService } from './push-tick.service';

describe('PushController', () => {
  let controller: PushController;
  let pushServiceMock: {
    subscribe: jest.Mock;
    unsubscribe: jest.Mock;
    updateTopics: jest.Mock;
    testSelf: jest.Mock;
    getLog: jest.Mock;
  };
  let pushTickServiceMock: {
    verifyCronSecret: jest.Mock;
    processTick: jest.Mock;
  };

  beforeEach(async () => {
    pushServiceMock = {
      subscribe: jest
        .fn()
        .mockResolvedValue({ subscribed: true, topics: ['night-prayer'] }),
      unsubscribe: jest.fn().mockResolvedValue({ unsubscribed: true }),
      updateTopics: jest
        .fn()
        .mockResolvedValue({ updated: true, topics: ['night-prayer'] }),
      testSelf: jest.fn().mockResolvedValue({ sent: true }),
      getLog: jest.fn().mockResolvedValue({
        logs: [],
        subscribers: { total: 0, byTopic: {} },
      }),
    };

    pushTickServiceMock = {
      verifyCronSecret: jest.fn(),
      processTick: jest
        .fn()
        .mockResolvedValue({ claimed: [], at: new Date().toISOString() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
      controllers: [PushController],
      providers: [
        { provide: PushService, useValue: pushServiceMock },
        { provide: PushTickService, useValue: pushTickServiceMock },
      ],
    }).compile();

    controller = module.get<PushController>(PushController);
  });

  it('delegates subscribe to pushService', async () => {
    const dto = {
      subscription: {
        endpoint: 'https://fcm.googleapis.com/fcm/send/1',
        keys: { p256dh: 'p', auth: 'a' },
      },
    };
    const req = { headers: {} } as any;
    const res = await controller.subscribe(dto, req);
    expect(res).toEqual({ subscribed: true, topics: ['night-prayer'] });
    expect(pushServiceMock.subscribe).toHaveBeenCalledWith(dto, req);
  });

  it('delegates unsubscribe to pushService', async () => {
    const res = await controller.unsubscribe({
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
    });
    expect(res).toEqual({ unsubscribed: true });
    expect(pushServiceMock.unsubscribe).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
    });
  });

  it('delegates updateTopics to pushService', async () => {
    const dto = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
      topics: ['night-prayer'] as any,
    };
    const res = await controller.updateTopics(dto);
    expect(res).toEqual({ updated: true, topics: ['night-prayer'] });
    expect(pushServiceMock.updateTopics).toHaveBeenCalledWith(dto);
  });

  it('delegates testSelf to pushService', async () => {
    const res = await controller.testSelf({
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
    });
    expect(res).toEqual({ sent: true });
    expect(pushServiceMock.testSelf).toHaveBeenCalledWith({
      endpoint: 'https://fcm.googleapis.com/fcm/send/1',
    });
  });

  it('delegates tick to pushTickService with cron secret verification', async () => {
    const res = await controller.tick('Bearer secret');
    expect(pushTickServiceMock.verifyCronSecret).toHaveBeenCalledWith(
      'Bearer secret',
    );
    expect(pushTickServiceMock.processTick).toHaveBeenCalled();
    expect(res.claimed).toBeDefined();
  });

  it('delegates getLog to pushService with user churchId', async () => {
    const user = {
      churchId: 'church-1',
      sub: 'user-1',
      email: 'a@b.com',
      roles: ['ADMIN'],
    };
    const res = await controller.getLog(user);
    expect(pushServiceMock.getLog).toHaveBeenCalledWith('church-1');
    expect(res.subscribers).toBeDefined();
  });
});
