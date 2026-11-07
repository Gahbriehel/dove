/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NightPrayerController } from './night-prayer.controller';
import { NightPrayerService } from './night-prayer.service';

describe('NightPrayerController', () => {
  let controller: NightPrayerController;
  let nightPrayerServiceMock: {
    getNextNightPrayer: jest.Mock;
    getNightPrayer: jest.Mock;
    putNightPrayer: jest.Mock;
    getExceptions: jest.Mock;
    createException: jest.Mock;
    removeException: jest.Mock;
  };
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
  };

  beforeEach(async () => {
    nightPrayerServiceMock = {
      getNextNightPrayer: jest.fn().mockResolvedValue({ status: 'upcoming' }),
      getNightPrayer: jest.fn().mockResolvedValue({ title: 'Night Prayer' }),
      putNightPrayer: jest.fn().mockResolvedValue({ title: 'Night Prayer' }),
      getExceptions: jest.fn().mockResolvedValue([]),
      createException: jest.fn().mockResolvedValue({ id: 'exc-1' }),
      removeException: jest.fn().mockResolvedValue({ message: 'Deleted' }),
    };

    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-default'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NightPrayerController],
      providers: [
        { provide: NightPrayerService, useValue: nightPrayerServiceMock },
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    controller = module.get<NightPrayerController>(NightPrayerController);
  });

  it('getNext uses query churchId or defaults, setting Cache-Control to no-store', async () => {
    const res = { setHeader: jest.fn() } as any;
    const result = await controller.getNext('church-custom', res);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(nightPrayerServiceMock.getNextNightPrayer).toHaveBeenCalledWith(
      'church-custom',
    );
    expect(result.status).toBe('upcoming');
  });

  it('getNext falls back to getDefaultChurchId when query param is omitted', async () => {
    const res = { setHeader: jest.fn() } as any;
    await controller.getNext(undefined, res);
    expect(prismaMock.getDefaultChurchId).toHaveBeenCalled();
    expect(nightPrayerServiceMock.getNextNightPrayer).toHaveBeenCalledWith(
      'church-default',
    );
  });

  it('delegates getNightPrayer to service', async () => {
    const user = {
      churchId: 'church-1',
      sub: 'u1',
      email: 'e',
      roles: ['ADMIN'],
    };
    const res = await controller.getNightPrayer(user);
    expect(nightPrayerServiceMock.getNightPrayer).toHaveBeenCalledWith(
      'church-1',
    );
    expect(res?.title).toBe('Night Prayer');
  });

  it('delegates putNightPrayer to service with user id', async () => {
    const user = {
      churchId: 'church-1',
      sub: 'u1',
      email: 'e',
      roles: ['ADMIN'],
    };
    const dto = {
      title: 'Night Prayer',
      meetUrl: 'https://meet.google.com/abc',
      timeOfDay: '22:00',
      daysOfWeek: [0],
    };
    await controller.putNightPrayer(dto, user);
    expect(nightPrayerServiceMock.putNightPrayer).toHaveBeenCalledWith(
      'church-1',
      dto,
      'u1',
    );
  });

  it('delegates exceptions operations to service', async () => {
    const user = {
      churchId: 'church-1',
      sub: 'u1',
      email: 'e',
      roles: ['ADMIN'],
    };
    await controller.getExceptions(user);
    expect(nightPrayerServiceMock.getExceptions).toHaveBeenCalledWith(
      'church-1',
    );

    await controller.createException({ date: '2026-11-12' }, user);
    expect(nightPrayerServiceMock.createException).toHaveBeenCalledWith(
      'church-1',
      { date: '2026-11-12' },
    );

    await controller.removeException('exc-1', user);
    expect(nightPrayerServiceMock.removeException).toHaveBeenCalledWith(
      'exc-1',
      'church-1',
    );
  });
});
