import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';

describe('NotificationSettingsController', () => {
  let controller: NotificationSettingsController;
  let serviceMock: {
    getSettings: jest.Mock;
    updateSettings: jest.Mock;
  };

  const user = {
    churchId: 'church-1',
    sub: 'u1',
    email: 'e',
    roles: ['ADMIN'],
  };

  beforeEach(async () => {
    serviceMock = {
      getSettings: jest.fn().mockResolvedValue({
        scriptureSendTime: '07:00',
        encouragementSlots: [],
      }),
      updateSettings: jest.fn().mockResolvedValue({
        scriptureSendTime: '08:00',
        encouragementSlots: [],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationSettingsController],
      providers: [
        { provide: NotificationSettingsService, useValue: serviceMock },
      ],
    }).compile();

    controller = module.get<NotificationSettingsController>(
      NotificationSettingsController,
    );
  });

  it('delegates getSettings and updateSettings to service', async () => {
    await controller.getSettings(user);
    expect(serviceMock.getSettings).toHaveBeenCalledWith('church-1');

    await controller.updateSettings({ scriptureSendTime: '08:00' }, user);
    expect(serviceMock.updateSettings).toHaveBeenCalledWith('church-1', {
      scriptureSendTime: '08:00',
    });
  });
});
