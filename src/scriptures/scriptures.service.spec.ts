/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ScriptureKind, ScriptureStatus } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ScripturesService } from './scriptures.service';
import * as scriptureUtil from './utils/scripture.util';

describe('ScripturesService', () => {
  let service: ScripturesService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    church: {
      findUnique: jest.Mock;
    };
    scripture: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
  };

  const adminUser: ActiveUserData = {
    sub: 'admin-user-id',
    email: 'admin@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      church: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'church-1', name: 'Abundant Word' }),
      },
      scripture: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScripturesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ScripturesService>(ScripturesService);
  });

  describe('getCurrentScriptures (Public)', () => {
    it('returns latest published record per kind and ignores drafts', async () => {
      const mockWeek = {
        id: 'week-1',
        churchId: 'church-1',
        kind: ScriptureKind.WEEK,
        text: 'The Lord is my strength and my shield',
        reference: 'Psalm 28:7',
        translation: 'NKJV',
        givenBy: 'Rev. Deji Olabode',
        startsOn: new Date('2026-11-02T00:00:00.000Z'),
        status: ScriptureStatus.PUBLISHED,
        createdById: 'admin-1',
        updatedById: 'admin-1',
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        updatedAt: new Date('2026-11-01T10:00:00.000Z'),
      };

      const mockYear = {
        id: 'year-1',
        churchId: 'church-1',
        kind: ScriptureKind.YEAR,
        text: 'Behold, I will do a new thing',
        reference: 'Isaiah 43:19',
        translation: 'NKJV',
        givenBy: null,
        startsOn: new Date('2026-01-01T00:00:00.000Z'),
        status: ScriptureStatus.PUBLISHED,
        createdById: 'admin-1',
        updatedById: 'admin-1',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      };

      prismaMock.scripture.findFirst
        .mockResolvedValueOnce(mockWeek)
        .mockResolvedValueOnce(mockYear);

      const result = await service.getCurrentScriptures('church-1');

      expect(prismaMock.scripture.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: 'church-1',
            kind: ScriptureKind.WEEK,
            status: ScriptureStatus.PUBLISHED,
          }),
          orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        }),
      );

      expect(prismaMock.scripture.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            churchId: 'church-1',
            kind: ScriptureKind.YEAR,
            status: ScriptureStatus.PUBLISHED,
          }),
          orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        }),
      );

      expect(result).toEqual({
        week: {
          id: 'week-1',
          kind: 'WEEK',
          text: 'The Lord is my strength and my shield',
          reference: 'Psalm 28:7',
          translation: 'NKJV',
          givenBy: 'Rev. Deji Olabode',
          startsOn: '2026-11-02',
        },
        year: {
          id: 'year-1',
          kind: 'YEAR',
          text: 'Behold, I will do a new thing',
          reference: 'Isaiah 43:19',
          translation: 'NKJV',
          givenBy: null,
          startsOn: '2026-01-01',
        },
      });
    });

    it('leaks no admin fields in public response', async () => {
      const mockRecord = {
        id: 'week-1',
        churchId: 'church-1',
        kind: ScriptureKind.WEEK,
        text: 'The Lord is good',
        reference: 'Nahum 1:7',
        translation: 'NKJV',
        givenBy: 'Pastor John',
        startsOn: new Date('2026-11-02T00:00:00.000Z'),
        status: ScriptureStatus.PUBLISHED,
        createdById: 'admin-secret-id',
        updatedById: 'admin-secret-id-2',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.scripture.findFirst
        .mockResolvedValueOnce(mockRecord)
        .mockResolvedValueOnce(null);

      const result = await service.getCurrentScriptures('church-1');
      const week = result.week as any;

      expect(week).toBeDefined();
      expect(week.status).toBeUndefined();
      expect(week.createdById).toBeUndefined();
      expect(week.updatedById).toBeUndefined();
      expect(week.createdAt).toBeUndefined();
      expect(week.updatedAt).toBeUndefined();
      expect(week.churchId).toBeUndefined();
    });

    it('returns null for a kind with no eligible record without throwing', async () => {
      prismaMock.scripture.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await service.getCurrentScriptures('church-1');
      expect(result).toEqual({
        week: null,
        year: null,
      });
    });

    it('uses getDefaultChurchId when no churchId or user is provided', async () => {
      prismaMock.scripture.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.getCurrentScriptures();
      expect(prismaMock.getDefaultChurchId).toHaveBeenCalled();
    });

    it('throws NotFoundException if target church does not exist', async () => {
      prismaMock.church.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getCurrentScriptures('unknown-church'),
      ).rejects.toThrow(NotFoundException);
    });

    it('computes today around midnight in Lagos (WAT UTC+1)', () => {
      // 11:30 PM UTC on Nov 6 is 12:30 AM on Nov 7 in Lagos
      const utcDate = new Date('2026-11-06T23:30:00.000Z');
      const lagosDate = scriptureUtil.getTodayInLagos(utcDate);
      expect(lagosDate).toBe('2026-11-07');

      // 12:30 AM UTC on Nov 7 is 01:30 AM on Nov 7 in Lagos
      const utcDateMorning = new Date('2026-11-07T00:30:00.000Z');
      expect(scriptureUtil.getTodayInLagos(utcDateMorning)).toBe('2026-11-07');
    });

    it('orders by startsOn DESC and createdAt DESC for tie-breaking', async () => {
      prismaMock.scripture.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.getCurrentScriptures('church-1');

      expect(prismaMock.scripture.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        }),
      );
    });
  });

  describe('findAll (Admin)', () => {
    it('returns paginated items with isCurrent flag set for live record', async () => {
      const liveWeekId = 'live-week-id';
      const scheduledWeekId = 'scheduled-week-id';

      prismaMock.scripture.findFirst
        .mockResolvedValueOnce({ id: liveWeekId }) // current week
        .mockResolvedValueOnce(null); // current year

      const items = [
        {
          id: scheduledWeekId,
          churchId: 'church-1',
          kind: ScriptureKind.WEEK,
          text: 'Next week verse',
          reference: 'John 1:1',
          translation: 'NKJV',
          givenBy: null,
          startsOn: new Date('2026-11-16T00:00:00.000Z'),
          status: ScriptureStatus.PUBLISHED,
          createdAt: new Date('2026-11-05'),
          updatedAt: new Date('2026-11-05'),
        },
        {
          id: liveWeekId,
          churchId: 'church-1',
          kind: ScriptureKind.WEEK,
          text: 'This week verse',
          reference: 'Psalm 23:1',
          translation: 'NKJV',
          givenBy: null,
          startsOn: new Date('2026-11-02T00:00:00.000Z'),
          status: ScriptureStatus.PUBLISHED,
          createdAt: new Date('2026-11-01'),
          updatedAt: new Date('2026-11-01'),
        },
      ];

      prismaMock.scripture.findMany.mockResolvedValueOnce(items);
      prismaMock.scripture.count.mockResolvedValueOnce(2);

      const result = await service.findAll(
        { kind: ScriptureKind.WEEK, page: 1, limit: 20 },
        adminUser,
      );

      expect(result.items.length).toBe(2);
      expect(result.items[0].id).toBe(scheduledWeekId);
      expect(result.items[0].isCurrent).toBe(false);
      expect(result.items[1].id).toBe(liveWeekId);
      expect(result.items[1].isCurrent).toBe(true);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('applies filters for kind and status', async () => {
      prismaMock.scripture.findFirst.mockResolvedValue(null);
      prismaMock.scripture.findMany.mockResolvedValueOnce([]);
      prismaMock.scripture.count.mockResolvedValueOnce(0);

      await service.findAll(
        { kind: ScriptureKind.YEAR, status: ScriptureStatus.DRAFT },
        adminUser,
      );

      expect(prismaMock.scripture.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            churchId: 'church-1',
            kind: ScriptureKind.YEAR,
            status: ScriptureStatus.DRAFT,
          },
        }),
      );
    });
  });

  describe('create (Admin)', () => {
    it('creates record with church from caller token and defaults startsOn to today Lagos', async () => {
      const createdRecord = {
        id: 'new-id',
        churchId: 'church-1',
        kind: ScriptureKind.WEEK,
        text: 'The Lord is my light',
        reference: 'Psalm 27:1',
        translation: 'NKJV',
        givenBy: 'Pastor Deji',
        startsOn: new Date('2026-11-07T00:00:00.000Z'),
        status: ScriptureStatus.DRAFT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.scripture.create.mockResolvedValueOnce(createdRecord);

      const result = await service.create(
        {
          kind: ScriptureKind.WEEK,
          text: 'The Lord is my light',
          reference: 'Psalm 27:1',
          translation: 'NKJV',
          givenBy: 'Pastor Deji',
        },
        adminUser,
      );

      expect(prismaMock.scripture.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            churchId: 'church-1',
            kind: ScriptureKind.WEEK,
            createdById: 'admin-user-id',
            updatedById: 'admin-user-id',
            status: ScriptureStatus.DRAFT,
          }),
        }),
      );

      expect(result.id).toBe('new-id');
      expect(result.startsOn).toBe('2026-11-07');
    });

    it('throws BadRequestException if publishing with empty text or reference', async () => {
      await expect(
        service.create(
          {
            kind: ScriptureKind.WEEK,
            text: '   ',
            reference: 'Psalm 23:1',
            status: ScriptureStatus.PUBLISHED,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create(
          {
            kind: ScriptureKind.WEEK,
            text: 'Valid text',
            reference: '   ',
            status: ScriptureStatus.PUBLISHED,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update (Admin)', () => {
    it('updates record and sets updatedById to caller', async () => {
      const existing = {
        id: 's-1',
        churchId: 'church-1',
        kind: ScriptureKind.WEEK,
        text: 'Original verse',
        reference: 'Psalm 1:1',
        translation: 'NKJV',
        givenBy: null,
        startsOn: new Date('2026-11-02T00:00:00.000Z'),
        status: ScriptureStatus.DRAFT,
      };

      prismaMock.scripture.findUnique.mockResolvedValueOnce(existing);
      prismaMock.scripture.update.mockResolvedValueOnce({
        ...existing,
        text: 'Updated verse',
        status: ScriptureStatus.PUBLISHED,
        updatedById: 'admin-user-id',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update(
        's-1',
        { text: 'Updated verse', status: ScriptureStatus.PUBLISHED },
        adminUser,
      );

      expect(prismaMock.scripture.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1' },
          data: expect.objectContaining({
            text: 'Updated verse',
            status: ScriptureStatus.PUBLISHED,
            updatedById: 'admin-user-id',
          }),
        }),
      );

      expect(result.text).toBe('Updated verse');
      expect(result.status).toBe(ScriptureStatus.PUBLISHED);
    });

    it('rejects update belonging to another church with 404 NotFound', async () => {
      const existing = {
        id: 's-other',
        churchId: 'other-church-id',
      };

      prismaMock.scripture.findUnique.mockResolvedValueOnce(existing);

      await expect(
        service.update('s-other', { text: 'Attempted hack' }, adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('checks merged fields on PATCH when publishing', async () => {
      const existing = {
        id: 's-1',
        churchId: 'church-1',
        kind: ScriptureKind.WEEK,
        text: '',
        reference: 'John 1:1',
        status: ScriptureStatus.DRAFT,
      };

      prismaMock.scripture.findUnique.mockResolvedValueOnce(existing);

      // Attempting to publish when text is empty in existing and omitted in dto
      await expect(
        service.update('s-1', { status: ScriptureStatus.PUBLISHED }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove (Admin)', () => {
    it('hard deletes the record', async () => {
      const existing = {
        id: 's-1',
        churchId: 'church-1',
      };

      prismaMock.scripture.findUnique.mockResolvedValueOnce(existing);
      prismaMock.scripture.delete.mockResolvedValueOnce(existing);

      const result = await service.remove('s-1', adminUser);

      expect(prismaMock.scripture.delete).toHaveBeenCalledWith({
        where: { id: 's-1' },
      });
      expect(result.message).toBe('Scripture deleted successfully');
    });

    it('rejects delete belonging to another church with 404 NotFound', async () => {
      const existing = {
        id: 's-other',
        churchId: 'other-church-id',
      };

      prismaMock.scripture.findUnique.mockResolvedValueOnce(existing);

      await expect(service.remove('s-other', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
