import { callArg, MockModel } from '../common/testing/mock.util';
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: {
    getDefaultChurchId: jest.Mock;
    church: MockModel;
    user: MockModel;
  };

  const church = {
    id: 'church-1',
    name: 'Abiding Word Of Grace Missions',
    slug: 'abwog',
    shortName: 'Amazing Grace',
    whatsappNumber: '+2348012345678',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest.fn().mockResolvedValue(church),
        update: jest.fn().mockResolvedValue(church),
      },
      user: { findUnique: jest.fn(), update: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  describe('church settings', () => {
    it('returns shortName and whatsappNumber', async () => {
      const result = await service.getChurchSettings('church-1');
      expect(result.shortName).toBe('Amazing Grace');
      expect(result.whatsappNumber).toBe('+2348012345678');
    });

    it('normalises the WhatsApp and primary phone numbers', async () => {
      await service.updateChurchSettings(
        {
          whatsappNumber: '0801 234 5678',
          primaryPhone: '+234 803 456 7890',
          shortName: ' Amazing Grace ',
        },
        'church-1',
      );

      expect(prisma.church.update).toHaveBeenCalledWith({
        where: { id: 'church-1' },
        data: {
          shortName: 'Amazing Grace',
          phone: '+2348034567890',
          whatsappNumber: '+2348012345678',
        },
      });
    });

    it('clears the WhatsApp number and short name when blank', async () => {
      await service.updateChurchSettings(
        { whatsappNumber: '', shortName: '  ' },
        'church-1',
      );

      expect(callArg(prisma.church.update, 0).data).toEqual({
        shortName: null,
        whatsappNumber: null,
      });
    });

    it('rejects an invalid WhatsApp number', async () => {
      await expect(
        service.updateChurchSettings({ whatsappNumber: '123' }, 'church-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.church.update).not.toHaveBeenCalled();
    });
  });

  describe('user profile', () => {
    const user = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      displayName: 'Pastor John',
      email: 'j@x.org',
      phone: null,
      isActive: true,
      churchId: 'church-1',
      passwordHash: 'x',
      createdAt: new Date(),
      updatedAt: new Date(),
      userRoles: [],
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);
    });

    it('returns displayName', async () => {
      const result = await service.getProfile('user-1');
      expect(result.displayName).toBe('Pastor John');
    });

    it('updates displayName and normalises phone', async () => {
      await service.updateProfile('user-1', {
        displayName: ' Pastor J ',
        phone: '08034567890',
      });

      const data = callArg(prisma.user.update, 0).data;
      expect(data.displayName).toBe('Pastor J');
      expect(data.phone).toBe('+2348034567890');
    });

    it('clears displayName when blank', async () => {
      await service.updateProfile('user-1', { displayName: ' ' });
      expect(callArg(prisma.user.update, 0).data.displayName).toBeNull();
    });

    it('rejects an invalid phone number', async () => {
      await expect(
        service.updateProfile('user-1', { phone: '12' }),
      ).rejects.toThrow('Please enter a valid phone number');
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
