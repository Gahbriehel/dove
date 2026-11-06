/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ValidationPipe } from '@nestjs/common';
import { GivingCurrency, GivingPurpose } from '@prisma/client';
import { CreateGivingAccountDto } from './dto/create-giving-account.dto';
import { QueryGivingAccountDto } from './dto/query-giving-account.dto';
import { ReorderGivingAccountsDto } from './dto/reorder-giving-accounts.dto';
import { UpdateGivingAccountDto } from './dto/update-giving-account.dto';

describe('Giving Accounts DTO Validation', () => {
  const target = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  describe('CreateGivingAccountDto', () => {
    const validDto = {
      label: 'Tithes & Offerings',
      bankName: 'GTBank',
      accountName: 'Abiding Word Of Grace Missions',
      accountNumber: '0123456789',
      currency: GivingCurrency.NGN,
      purposes: [GivingPurpose.TITHE, GivingPurpose.OFFERING],
      note: 'Use your name',
      isActive: true,
      sortOrder: 0,
    };

    it('passes with valid input', async () => {
      const result = await target.transform(validDto, {
        type: 'body',
        metatype: CreateGivingAccountDto,
      });
      expect(result.accountNumber).toBe('0123456789');
      expect(result.label).toBe('Tithes & Offerings');
    });

    it('strips spaces and hyphens from accountNumber', async () => {
      const result = await target.transform(
        {
          ...validDto,
          accountNumber: '012 345-6789',
        },
        { type: 'body', metatype: CreateGivingAccountDto },
      );
      expect(result.accountNumber).toBe('0123456789');
    });

    it('rejects NGN account number that is not 10 digits', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            currency: GivingCurrency.NGN,
            accountNumber: '12345678', // 8 digits
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('accepts USD account number with 8 digits', async () => {
      const result = await target.transform(
        {
          ...validDto,
          currency: GivingCurrency.USD,
          accountNumber: '12345678',
        },
        { type: 'body', metatype: CreateGivingAccountDto },
      );
      expect(result.currency).toBe(GivingCurrency.USD);
      expect(result.accountNumber).toBe('12345678');
    });

    it('rejects account number with letters or invalid characters', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            accountNumber: '012345678A',
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects empty purposes array', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            purposes: [],
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects duplicate purposes', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            purposes: [GivingPurpose.TITHE, GivingPurpose.TITHE],
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects unknown purpose values', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            purposes: ['INVALID_PURPOSE'],
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects non-whitelisted churchId in create body', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            churchId: 'attacker-church',
          },
          { type: 'body', metatype: CreateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('transforms empty note string to null', async () => {
      const result = await target.transform(
        {
          ...validDto,
          note: '   ',
        },
        { type: 'body', metatype: CreateGivingAccountDto },
      );
      expect(result.note).toBeNull();
    });
  });

  describe('UpdateGivingAccountDto', () => {
    it('accepts partial update', async () => {
      const result = await target.transform(
        { label: 'Updated Label' },
        { type: 'body', metatype: UpdateGivingAccountDto },
      );
      expect(result.label).toBe('Updated Label');
    });

    it('rejects duplicate purposes on update', async () => {
      await expect(
        target.transform(
          { purposes: [GivingPurpose.OFFERING, GivingPurpose.OFFERING] },
          { type: 'body', metatype: UpdateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects empty purposes array on update', async () => {
      await expect(
        target.transform(
          { purposes: [] },
          { type: 'body', metatype: UpdateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects churchId in update body', async () => {
      await expect(
        target.transform(
          { churchId: 'other-church' },
          { type: 'body', metatype: UpdateGivingAccountDto },
        ),
      ).rejects.toThrow();
    });
  });

  describe('ReorderGivingAccountsDto', () => {
    it('accepts unique array of string ids', async () => {
      const result = await target.transform(
        { ids: ['id-1', 'id-2'] },
        { type: 'body', metatype: ReorderGivingAccountsDto },
      );
      expect(result.ids).toEqual(['id-1', 'id-2']);
    });

    it('rejects empty ids array', async () => {
      await expect(
        target.transform(
          { ids: [] },
          { type: 'body', metatype: ReorderGivingAccountsDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects duplicate ids in reorder list', async () => {
      await expect(
        target.transform(
          { ids: ['id-1', 'id-1'] },
          { type: 'body', metatype: ReorderGivingAccountsDto },
        ),
      ).rejects.toThrow();
    });
  });

  describe('QueryGivingAccountDto', () => {
    it('accepts valid GivingPurpose', async () => {
      const result = await target.transform(
        { purpose: 'TITHE' },
        { type: 'query', metatype: QueryGivingAccountDto },
      );
      expect(result.purpose).toBe(GivingPurpose.TITHE);
    });

    it('rejects unknown GivingPurpose with 400 validation error', async () => {
      await expect(
        target.transform(
          { purpose: 'INVALID_PURPOSE' },
          { type: 'query', metatype: QueryGivingAccountDto },
        ),
      ).rejects.toThrow();
    });
  });
});
