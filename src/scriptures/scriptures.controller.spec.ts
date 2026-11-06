import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { ScriptureKind } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { ScripturesController } from './scriptures.controller';
import { ScripturesService } from './scriptures.service';

describe('ScripturesController', () => {
  let controller: ScripturesController;
  let serviceMock: {
    getCurrentScriptures: jest.Mock;
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const adminUser: ActiveUserData = {
    sub: 'admin-1',
    email: 'admin@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    serviceMock = {
      getCurrentScriptures: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScripturesController],
      providers: [
        {
          provide: ScripturesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<ScripturesController>(ScripturesController);
  });

  it('delegates getCurrent to service and sets Cache-Control header', async () => {
    const setHeader = jest.fn();
    const mockRes = { setHeader } as unknown as Response;

    const mockResult = {
      week: {
        id: 'w-1',
        kind: ScriptureKind.WEEK,
        text: 'God is good',
        reference: 'Psalm 100:5',
        translation: 'NKJV',
        givenBy: null,
        startsOn: '2026-11-02',
      },
      year: null,
    };

    serviceMock.getCurrentScriptures.mockResolvedValueOnce(mockResult);

    const result = await controller.getCurrent('church-1', mockRes, undefined);

    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60',
    );
    expect(serviceMock.getCurrentScriptures).toHaveBeenCalledWith(
      'church-1',
      undefined,
    );
    expect(result).toEqual(mockResult);
  });

  it('delegates findAll to service', async () => {
    const query = { page: 1, limit: 20 };
    serviceMock.findAll.mockResolvedValueOnce({
      items: [],
      meta: { total: 0 },
    });

    const result = await controller.findAll(query, adminUser);
    expect(serviceMock.findAll).toHaveBeenCalledWith(query, adminUser);
    expect(result).toBeDefined();
  });

  it('delegates create to service', async () => {
    const dto = {
      kind: ScriptureKind.WEEK,
      text: 'Verse text',
      reference: 'Ref 1:1',
    };
    serviceMock.create.mockResolvedValueOnce({ id: 's-1', ...dto });

    const result = await controller.create(dto, adminUser);
    expect(serviceMock.create).toHaveBeenCalledWith(dto, adminUser);
    expect(result.id).toBe('s-1');
  });

  it('delegates update to service', async () => {
    const dto = { text: 'Updated verse' };
    serviceMock.update.mockResolvedValueOnce({ id: 's-1', ...dto });

    const result = await controller.update('s-1', dto, adminUser);
    expect(serviceMock.update).toHaveBeenCalledWith('s-1', dto, adminUser);
    expect(result.text).toBe('Updated verse');
  });

  it('delegates remove to service', async () => {
    serviceMock.remove.mockResolvedValueOnce({
      message: 'Scripture deleted successfully',
    });

    const result = await controller.remove('s-1', adminUser);
    expect(serviceMock.remove).toHaveBeenCalledWith('s-1', adminUser);
    expect(result.message).toBe('Scripture deleted successfully');
  });
});
