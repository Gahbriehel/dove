import { callArg, MockModel } from '../common/testing/mock.util';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CheckInReason, OutreachPurpose } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessageTemplatesService } from './message-templates.service';

describe('MessageTemplatesService', () => {
  let service: MessageTemplatesService;
  let prisma: {
    getDefaultChurchId: jest.Mock;
    church: MockModel;
    user: MockModel;
    messageTemplate: MockModel;
    outreachMessage: MockModel;
  };

  beforeEach(async () => {
    prisma = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      messageTemplate: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      outreachMessage: { count: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        MessageTemplatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(MessageTemplatesService);
  });

  describe('findAll', () => {
    it('hides inactive templates unless asked', async () => {
      prisma.messageTemplate.findMany.mockResolvedValue([]);

      await service.findAll({ purpose: OutreachPurpose.BIRTHDAY }, 'church-1');
      expect(callArg(prisma.messageTemplate.findMany, 0).where).toEqual({
        churchId: 'church-1',
        purpose: OutreachPurpose.BIRTHDAY,
        isActive: true,
      });

      await service.findAll({ includeInactive: true }, 'church-1');
      expect(callArg(prisma.messageTemplate.findMany, 1).where).toEqual({
        churchId: 'church-1',
      });
    });
  });

  describe('create', () => {
    const base = {
      purpose: OutreachPurpose.BIRTHDAY,
      name: ' Blessing ',
      body: 'Happy birthday {{ firstName }}!',
    };

    it('creates a template for the church and trims the name', async () => {
      prisma.messageTemplate.create.mockResolvedValue({ id: 't-1' });
      await service.create(base, 'user-1', 'church-1');

      expect(callArg(prisma.messageTemplate.create).data).toMatchObject({
        churchId: 'church-1',
        name: 'Blessing',
        createdById: 'user-1',
        checkInReason: null,
      });
    });

    it('rejects unknown placeholders and lists them', async () => {
      await expect(
        service.create(
          { ...base, body: 'Hi {{nickname}} and {{lastName}}' },
          'user-1',
          'church-1',
        ),
      ).rejects.toThrow('{{nickname}}, {{lastName}}');
      expect(prisma.messageTemplate.create).not.toHaveBeenCalled();
    });

    it('rejects a checkInReason on a non check-in template', async () => {
      await expect(
        service.create(
          { ...base, checkInReason: CheckInReason.ILLNESS },
          'user-1',
          'church-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('accepts a checkInReason on a check-in template', async () => {
      prisma.messageTemplate.create.mockResolvedValue({ id: 't-1' });
      await service.create(
        {
          ...base,
          purpose: OutreachPurpose.PASTORAL_CHECK_IN,
          checkInReason: CheckInReason.ILLNESS,
        },
        'user-1',
        'church-1',
      );
      expect(callArg(prisma.messageTemplate.create, 0).data.checkInReason).toBe(
        CheckInReason.ILLNESS,
      );
    });
  });

  describe('update', () => {
    const existing = {
      id: 't-1',
      purpose: OutreachPurpose.PASTORAL_CHECK_IN,
      checkInReason: CheckInReason.ILLNESS,
      body: 'Hi {{firstName}}',
    };

    it('returns 404 for a template in another church', async () => {
      prisma.messageTemplate.findFirst.mockResolvedValue(null);
      await expect(
        service.update('t-1', { name: 'x' }, 'church-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates a changed body', async () => {
      prisma.messageTemplate.findFirst.mockResolvedValue(existing);
      await expect(
        service.update('t-1', { body: '{{oops}}' }, 'church-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('clears the reason when the purpose changes away from check-ins', async () => {
      prisma.messageTemplate.findFirst.mockResolvedValue(existing);
      prisma.messageTemplate.update.mockResolvedValue({ id: 't-1' });

      await service.update(
        't-1',
        { purpose: OutreachPurpose.BIRTHDAY },
        'church-1',
      );

      expect(
        callArg(prisma.messageTemplate.update, 0).data.checkInReason,
      ).toBeNull();
    });

    it('keeps the reason when only the body changes', async () => {
      prisma.messageTemplate.findFirst.mockResolvedValue(existing);
      prisma.messageTemplate.update.mockResolvedValue({ id: 't-1' });

      await service.update('t-1', { body: 'Hello {{firstName}}' }, 'church-1');

      expect(callArg(prisma.messageTemplate.update, 0).data.checkInReason).toBe(
        CheckInReason.ILLNESS,
      );
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      prisma.messageTemplate.findFirst.mockResolvedValue({ id: 't-1' });
    });

    it('soft deletes a template used in outreach', async () => {
      prisma.outreachMessage.count.mockResolvedValue(3);
      const result = await service.remove('t-1', 'church-1');

      expect(prisma.messageTemplate.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { isActive: false },
      });
      expect(prisma.messageTemplate.delete).not.toHaveBeenCalled();
      expect(result).toMatchObject({ deleted: false, deactivated: true });
    });

    it('hard deletes an unused template', async () => {
      prisma.outreachMessage.count.mockResolvedValue(0);
      const result = await service.remove('t-1', 'church-1');

      expect(prisma.messageTemplate.delete).toHaveBeenCalledWith({
        where: { id: 't-1' },
      });
      expect(result).toMatchObject({ deleted: true, deactivated: false });
    });
  });

  describe('preview', () => {
    it('renders with sample values, the admin name and the church label', async () => {
      prisma.church.findUnique.mockResolvedValue({
        name: 'Abiding Word Of Grace Missions',
        shortName: 'Amazing Grace',
      });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'John',
        displayName: 'Pastor John',
      });

      const result = await service.preview(
        '{{firstName}} / {{adminName}} / {{churchName}} / {{x}}',
        'user-1',
        'church-1',
      );

      expect(result.body).toBe('Sarah / Pastor John / Amazing Grace / {{x}}');
      expect(result.unknownPlaceholders).toEqual(['{{x}}']);
    });

    it('falls back to the full church name and first name', async () => {
      prisma.church.findUnique.mockResolvedValue({
        name: 'Abiding Word',
        shortName: null,
      });
      prisma.user.findUnique.mockResolvedValue({
        firstName: 'John',
        displayName: '  ',
      });

      const result = await service.preview(
        '{{adminName}} @ {{churchName}}',
        'user-1',
        'church-1',
      );
      expect(result.body).toBe('John @ Abiding Word');
    });
  });
});
