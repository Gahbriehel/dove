import { Test, TestingModule } from '@nestjs/testing';
import { GivingCurrency, GivingPurpose } from '@prisma/client';
import type { Response } from 'express';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { GivingAccountsController } from './giving-accounts.controller';
import { GivingAccountsService } from './giving-accounts.service';

describe('GivingAccountsController', () => {
  let controller: GivingAccountsController;
  let serviceMock: {
    findAll: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    reorder: jest.Mock;
    remove: jest.Mock;
  };

  const superAdminUser: ActiveUserData = {
    sub: 'user-super-admin',
    email: 'admin@church.org',
    roles: ['SUPER_ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    serviceMock = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      reorder: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GivingAccountsController],
      providers: [
        {
          provide: GivingAccountsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<GivingAccountsController>(GivingAccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('sets Cache-Control: public, max-age=60 on unauthenticated call', async () => {
      serviceMock.findAll.mockResolvedValue([]);
      const setHeader = jest.fn();
      const res = { setHeader } as unknown as Response;

      await controller.findAll({}, res, undefined);

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=60',
      );
      expect(serviceMock.findAll).toHaveBeenCalledWith({}, undefined);
    });

    it('sets Cache-Control: no-store on Super Admin call', async () => {
      serviceMock.findAll.mockResolvedValue([]);
      const setHeader = jest.fn();
      const res = { setHeader } as unknown as Response;

      await controller.findAll({}, res, superAdminUser);

      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(serviceMock.findAll).toHaveBeenCalledWith({}, superAdminUser);
    });
  });

  describe('create', () => {
    it('delegates to service.create', async () => {
      const dto = {
        label: 'Tithe',
        bankName: 'GTBank',
        accountName: 'Abwog',
        accountNumber: '0123456789',
        currency: GivingCurrency.NGN,
        purposes: [GivingPurpose.TITHE],
      };
      serviceMock.create.mockResolvedValue({ id: 'acc-1', ...dto });

      const result = await controller.create(dto, superAdminUser);

      expect(serviceMock.create).toHaveBeenCalledWith(dto, superAdminUser);
      expect(result.id).toBe('acc-1');
    });
  });

  describe('reorder', () => {
    it('delegates to service.reorder', async () => {
      const dto = { ids: ['acc-1', 'acc-2'] };
      serviceMock.reorder.mockResolvedValue({
        message: 'Giving accounts reordered successfully',
      });

      const result = await controller.reorder(dto, superAdminUser);

      expect(serviceMock.reorder).toHaveBeenCalledWith(dto, superAdminUser);
      expect(result).toEqual({
        message: 'Giving accounts reordered successfully',
      });
    });
  });

  describe('update', () => {
    it('delegates to service.update', async () => {
      const dto = { label: 'Updated' };
      serviceMock.update.mockResolvedValue({ id: 'acc-1', ...dto });

      const result = await controller.update('acc-1', dto, superAdminUser);

      expect(serviceMock.update).toHaveBeenCalledWith(
        'acc-1',
        dto,
        superAdminUser,
      );
      expect(result.id).toBe('acc-1');
    });
  });

  describe('remove', () => {
    it('delegates to service.remove', async () => {
      serviceMock.remove.mockResolvedValue({
        message: 'Giving account deleted successfully',
      });

      const result = await controller.remove('acc-1', superAdminUser);

      expect(serviceMock.remove).toHaveBeenCalledWith('acc-1', superAdminUser);
      expect(result).toEqual({
        message: 'Giving account deleted successfully',
      });
    });
  });
});
