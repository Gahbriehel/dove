/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GivingCurrency, GivingPurpose } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { GivingAccountsService } from './giving-accounts.service';

describe('GivingAccountsService', () => {
  let service: GivingAccountsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    givingAccount: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const superAdminUser: ActiveUserData = {
    sub: 'user-super-admin',
    email: 'admin@church.org',
    roles: ['SUPER_ADMIN'],
    churchId: 'church-1',
  };

  const staffUser: ActiveUserData = {
    sub: 'user-staff',
    email: 'staff@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest.fn(),
      },
      givingAccount: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GivingAccountsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<GivingAccountsService>(GivingAccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('public GET returns only active accounts, sorted, and no internal fields', async () => {
      const dbAccounts = [
        {
          id: 'acc-1',
          churchId: 'church-1',
          label: 'Tithes & Offerings',
          bankName: 'GTBank',
          accountName: 'Abiding Word',
          accountNumber: '0123456789',
          currency: GivingCurrency.NGN,
          note: 'Some note',
          purposes: [GivingPurpose.TITHE, GivingPurpose.OFFERING],
          sortOrder: 0,
          isActive: true,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          updatedById: 'user-1',
        },
      ];
      prismaMock.givingAccount.findMany.mockResolvedValue(dbAccounts);

      const result = await service.findAll({});

      expect(prismaMock.givingAccount.findMany).toHaveBeenCalledWith({
        where: { churchId: 'church-1', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      expect(result).toEqual([
        {
          id: 'acc-1',
          label: 'Tithes & Offerings',
          bankName: 'GTBank',
          accountName: 'Abiding Word',
          accountNumber: '0123456789',
          currency: GivingCurrency.NGN,
          note: 'Some note',
          purposes: [GivingPurpose.TITHE, GivingPurpose.OFFERING],
          sortOrder: 0,
          isActive: true,
        },
      ]);
      expect(result[0]).not.toHaveProperty('churchId');
      expect(result[0]).not.toHaveProperty('updatedById');
      expect(result[0]).not.toHaveProperty('createdAt');
      expect(result[0]).not.toHaveProperty('updatedAt');
    });

    it('Super Admin GET includes inactive ones', async () => {
      const dbAccounts = [
        {
          id: 'acc-1',
          churchId: 'church-1',
          label: 'Tithes',
          bankName: 'GTBank',
          accountName: 'Abiding Word',
          accountNumber: '0123456789',
          currency: GivingCurrency.NGN,
          note: null,
          purposes: [GivingPurpose.TITHE],
          sortOrder: 0,
          isActive: true,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          updatedById: 'user-1',
        },
        {
          id: 'acc-2',
          churchId: 'church-1',
          label: 'Old Account',
          bankName: 'Zenith Bank',
          accountName: 'Abiding Word',
          accountNumber: '1122334455',
          currency: GivingCurrency.NGN,
          note: null,
          purposes: [GivingPurpose.OFFERING],
          sortOrder: 1,
          isActive: false,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          updatedById: 'user-1',
        },
      ];
      prismaMock.givingAccount.findMany.mockResolvedValue(dbAccounts);

      const result = await service.findAll({}, superAdminUser);

      expect(prismaMock.givingAccount.findMany).toHaveBeenCalledWith({
        where: { churchId: 'church-1' },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result.length).toBe(2);
      expect(result[1].isActive).toBe(false);
    });

    it('non-Super Admin GET excludes inactive accounts even if authenticated', async () => {
      prismaMock.givingAccount.findMany.mockResolvedValue([]);

      await service.findAll({}, staffUser);

      expect(prismaMock.givingAccount.findMany).toHaveBeenCalledWith({
        where: { churchId: 'church-1', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });

    it('?purpose=TITHE returns only accounts containing that purpose', async () => {
      const dbAccounts = [
        {
          id: 'acc-1',
          churchId: 'church-1',
          label: 'Tithes & Offerings',
          bankName: 'GTBank',
          accountName: 'Abiding Word',
          accountNumber: '0123456789',
          currency: GivingCurrency.NGN,
          note: null,
          purposes: [GivingPurpose.TITHE, GivingPurpose.OFFERING],
          sortOrder: 0,
          isActive: true,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          updatedById: null,
        },
        {
          id: 'acc-2',
          churchId: 'church-1',
          label: 'Building Project',
          bankName: 'Zenith',
          accountName: 'Abiding Word',
          accountNumber: '9876543210',
          currency: GivingCurrency.NGN,
          note: null,
          purposes: [GivingPurpose.BUILDING],
          sortOrder: 1,
          isActive: true,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-02'),
          updatedById: null,
        },
      ];
      prismaMock.givingAccount.findMany.mockResolvedValue(dbAccounts);

      const result = await service.findAll({ purpose: GivingPurpose.TITHE });

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('acc-1');
      expect(result[0].purposes).toContain(GivingPurpose.TITHE);
    });

    it('uses churchId from query parameter if provided', async () => {
      prismaMock.givingAccount.findMany.mockResolvedValue([]);

      await service.findAll({ churchId: 'custom-church' });

      expect(prismaMock.givingAccount.findMany).toHaveBeenCalledWith({
        where: { churchId: 'custom-church', isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('create', () => {
    it('creates an account with default sortOrder (max + 1)', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.givingAccount.findFirst.mockResolvedValue({ sortOrder: 3 });
      prismaMock.givingAccount.create.mockResolvedValue({
        id: 'acc-new',
        churchId: 'church-1',
        label: 'Building Project',
        bankName: 'Zenith Bank',
        accountName: 'Abiding Word (Building)',
        accountNumber: '1012345678',
        currency: GivingCurrency.NGN,
        note: null,
        purposes: [GivingPurpose.BUILDING],
        sortOrder: 4,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: 'user-super-admin',
      });

      const result = await service.create(
        {
          label: '  Building Project  ',
          bankName: '  Zenith Bank  ',
          accountName: '  Abiding Word (Building)  ',
          accountNumber: '1012-345 678',
          purposes: [GivingPurpose.BUILDING],
        },
        superAdminUser,
      );

      expect(prismaMock.givingAccount.create).toHaveBeenCalledWith({
        data: {
          churchId: 'church-1',
          label: 'Building Project',
          bankName: 'Zenith Bank',
          accountName: 'Abiding Word (Building)',
          accountNumber: '1012345678',
          currency: GivingCurrency.NGN,
          note: null,
          purposes: [GivingPurpose.BUILDING],
          sortOrder: 4,
          isActive: true,
          updatedById: 'user-super-admin',
        },
      });
      expect(result.id).toBe('acc-new');
      expect(result.sortOrder).toBe(4);
    });

    it('throws NotFoundException if church does not exist', async () => {
      prismaMock.church.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            label: 'Test',
            bankName: 'Bank',
            accountName: 'Name',
            accountNumber: '0123456789',
            purposes: [GivingPurpose.TITHE],
          },
          superAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('accepts 8-digit account number for USD', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.givingAccount.findFirst.mockResolvedValue(null);
      prismaMock.givingAccount.create.mockResolvedValue({
        id: 'acc-usd',
        churchId: 'church-1',
        label: 'USD Gifts',
        bankName: 'JPMorgan Chase',
        accountName: 'Abiding Word Missions',
        accountNumber: '12345678',
        currency: GivingCurrency.USD,
        note: null,
        purposes: [GivingPurpose.SPECIAL],
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: 'user-super-admin',
      });

      const result = await service.create(
        {
          label: 'USD Gifts',
          bankName: 'JPMorgan Chase',
          accountName: 'Abiding Word Missions',
          accountNumber: '12345678',
          currency: GivingCurrency.USD,
          purposes: [GivingPurpose.SPECIAL],
        },
        superAdminUser,
      );

      expect(result.currency).toBe(GivingCurrency.USD);
      expect(result.accountNumber).toBe('12345678');
    });

    it('rejects NGN account number that is not 10 digits', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });

      await expect(
        service.create(
          {
            label: 'Test',
            bankName: 'Bank',
            accountName: 'Name',
            accountNumber: '12345678', // 8 digits with NGN default
            purposes: [GivingPurpose.TITHE],
          },
          superAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('stores empty note as null', async () => {
      prismaMock.church.findUnique.mockResolvedValue({ id: 'church-1' });
      prismaMock.givingAccount.findFirst.mockResolvedValue(null);
      prismaMock.givingAccount.create.mockResolvedValue({
        id: 'acc-1',
        churchId: 'church-1',
        label: 'Test',
        bankName: 'Bank',
        accountName: 'Name',
        accountNumber: '0123456789',
        currency: GivingCurrency.NGN,
        note: null,
        purposes: [GivingPurpose.TITHE],
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: 'user-super-admin',
      });

      await service.create(
        {
          label: 'Test',
          bankName: 'Bank',
          accountName: 'Name',
          accountNumber: '0123456789',
          purposes: [GivingPurpose.TITHE],
          note: '   ',
        },
        superAdminUser,
      );

      expect(prismaMock.givingAccount.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            note: null,
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates giving account and logs changes', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        churchId: 'church-1',
        accountNumber: '0123456789',
        currency: GivingCurrency.NGN,
      });
      prismaMock.givingAccount.update.mockResolvedValue({
        id: 'acc-1',
        churchId: 'church-1',
        label: 'Updated Label',
        bankName: 'GTBank',
        accountName: 'Abiding Word',
        accountNumber: '0987654321',
        currency: GivingCurrency.NGN,
        note: 'Updated note',
        purposes: [GivingPurpose.TITHE],
        sortOrder: 0,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedById: 'user-super-admin',
      });

      const result = await service.update(
        'acc-1',
        {
          label: 'Updated Label',
          accountNumber: '0987654321',
          isActive: false,
        },
        superAdminUser,
      );

      expect(prismaMock.givingAccount.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: expect.objectContaining({
          label: 'Updated Label',
          accountNumber: '0987654321',
          isActive: false,
          updatedById: 'user-super-admin',
        }),
      });
      expect(result.label).toBe('Updated Label');
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException if updating another church account', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue({
        id: 'acc-other',
        churchId: 'church-other',
      });

      await expect(
        service.update('acc-other', { label: 'New' }, superAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updating NGN account number to invalid length', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        churchId: 'church-1',
        accountNumber: '0123456789',
        currency: GivingCurrency.NGN,
      });

      await expect(
        service.update(
          'acc-1',
          { accountNumber: '12345' }, // less than 10 digits
          superAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reorder', () => {
    it('sets sortOrder to each id index in a transaction', async () => {
      prismaMock.givingAccount.findMany.mockResolvedValue([
        { id: 'acc-a' },
        { id: 'acc-b' },
        { id: 'acc-c' },
      ]);
      prismaMock.givingAccount.update.mockResolvedValue({});

      const result = await service.reorder(
        { ids: ['acc-b', 'acc-c', 'acc-a'] },
        superAdminUser,
      );

      expect(prismaMock.givingAccount.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['acc-b', 'acc-c', 'acc-a'] },
          churchId: 'church-1',
        },
        select: { id: true },
      });
      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Giving accounts reordered successfully',
      });
    });

    it('rejects if list contains unknown id or one from another church', async () => {
      prismaMock.givingAccount.findMany.mockResolvedValue([
        { id: 'acc-a' },
        // acc-b belongs to another church or does not exist
      ]);

      await expect(
        service.reorder({ ids: ['acc-a', 'acc-b'] }, superAdminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes the giving account', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue({
        id: 'acc-1',
        churchId: 'church-1',
      });
      prismaMock.givingAccount.delete.mockResolvedValue({});

      const result = await service.remove('acc-1', superAdminUser);

      expect(prismaMock.givingAccount.delete).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
      });
      expect(result).toEqual({
        message: 'Giving account deleted successfully',
      });
    });

    it('throws NotFoundException if deleting another church account', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue({
        id: 'acc-other',
        churchId: 'church-other',
      });

      await expect(service.remove('acc-other', superAdminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException if account does not exist', async () => {
      prismaMock.givingAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.remove('non-existent', superAdminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
