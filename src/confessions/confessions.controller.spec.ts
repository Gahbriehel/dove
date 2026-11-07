import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Response } from 'express';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { ConfessionsController } from './confessions.controller';
import { ConfessionsService } from './confessions.service';

describe('ConfessionsController', () => {
  let controller: ConfessionsController;
  let serviceMock: {
    findAll: jest.Mock;
    findCategories: jest.Mock;
    findOne: jest.Mock;
    recordListen: jest.Mock;
    create: jest.Mock;
    reorder: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    uploadAudio: jest.Mock;
    removeAudio: jest.Mock;
    getReminders?: jest.Mock;
    updateReminders?: jest.Mock;
  };

  const adminUser: ActiveUserData = {
    sub: 'user-admin',
    email: 'admin@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      findCategories: jest.fn(),
      findOne: jest.fn(),
      recordListen: jest.fn(),
      create: jest.fn(),
      reorder: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      uploadAudio: jest.fn(),
      removeAudio: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }])],
      controllers: [ConfessionsController],
      providers: [
        {
          provide: ConfessionsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ConfessionsController>(ConfessionsController);
  });

  it('delegates findAll to service', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], meta: {} });
    const result = await controller.findAll({}, adminUser);
    expect(serviceMock.findAll).toHaveBeenCalledWith({}, adminUser);
    expect(result).toBeDefined();
  });

  it('sets Cache-Control on categories endpoint', async () => {
    const setHeader = jest.fn();
    const mockRes = { setHeader } as unknown as Response;

    serviceMock.findCategories.mockResolvedValueOnce(['Healing', 'Protection']);

    const result = await controller.findCategories('church-1', mockRes);
    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60',
    );
    expect(result).toEqual(['Healing', 'Protection']);
  });

  it('delegates recordListen to service', async () => {
    serviceMock.recordListen.mockResolvedValueOnce(undefined);
    await controller.recordListen('c-1');
    expect(serviceMock.recordListen).toHaveBeenCalledWith('c-1');
  });

  it('delegates create to service', async () => {
    const dto = { title: 'Test', body: 'Test body' };
    serviceMock.create.mockResolvedValueOnce({ id: 'c-1', ...dto });

    const result = await controller.create(dto, adminUser);
    expect(serviceMock.create).toHaveBeenCalledWith(dto, adminUser);
    expect(result.id).toBe('c-1');
  });

  it('delegates reorder to service', async () => {
    serviceMock.reorder.mockResolvedValueOnce({ reordered: 2 });
    const result = await controller.reorder({ ids: ['c-1', 'c-2'] }, adminUser);
    expect(serviceMock.reorder).toHaveBeenCalledWith(
      { ids: ['c-1', 'c-2'] },
      adminUser,
    );
    expect(result).toEqual({ reordered: 2 });
  });

  it('delegates update to service', async () => {
    serviceMock.update.mockResolvedValueOnce({ id: 'c-1', title: 'New' });
    const result = await controller.update('c-1', { title: 'New' }, adminUser);
    expect(serviceMock.update).toHaveBeenCalledWith(
      'c-1',
      { title: 'New' },
      adminUser,
    );
    expect(result.title).toBe('New');
  });

  it('delegates remove to service', async () => {
    serviceMock.remove.mockResolvedValueOnce({ message: 'Deleted' });
    const result = await controller.remove('c-1', adminUser);
    expect(serviceMock.remove).toHaveBeenCalledWith('c-1', adminUser);
    expect(result.message).toBe('Deleted');
  });

  it('delegates uploadAudio to service', async () => {
    const mockFile = {
      buffer: Buffer.from('test'),
      originalname: 'audio.mp3',
      mimetype: 'audio/mpeg',
    } as Express.Multer.File;

    serviceMock.uploadAudio.mockResolvedValueOnce({ id: 'c-1' });
    const result = await controller.uploadAudio(
      'c-1',
      'female',
      mockFile,
      adminUser,
    );
    expect(serviceMock.uploadAudio).toHaveBeenCalledWith(
      'c-1',
      'female',
      mockFile,
      adminUser,
    );
    expect(result.id).toBe('c-1');
  });

  it('delegates removeAudio to service', async () => {
    serviceMock.removeAudio.mockResolvedValueOnce({ message: 'Audio deleted' });
    const result = await controller.removeAudio('c-1', 'female', adminUser);
    expect(serviceMock.removeAudio).toHaveBeenCalledWith(
      'c-1',
      'female',
      adminUser,
    );
    expect(result.message).toBe('Audio deleted');
  });

  it('delegates getReminders to service', async () => {
    serviceMock.getReminders = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'rem-1', timeOfDay: '06:30' }]);
    const result = await controller.getReminders('c-1', adminUser);
    expect(serviceMock.getReminders).toHaveBeenCalledWith('c-1', adminUser);
    expect(result).toHaveLength(1);
  });

  it('delegates updateReminders to service', async () => {
    const dto = { reminders: [{ timeOfDay: '06:30' }] };
    serviceMock.updateReminders = jest
      .fn()
      .mockResolvedValueOnce([{ id: 'rem-1', timeOfDay: '06:30' }]);
    const result = await controller.updateReminders('c-1', dto, adminUser);
    expect(serviceMock.updateReminders).toHaveBeenCalledWith(
      'c-1',
      dto,
      adminUser,
    );
    expect(result).toHaveLength(1);
  });
});
