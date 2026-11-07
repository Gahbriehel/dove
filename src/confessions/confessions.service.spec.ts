/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfessionStatus, ConfessionVoice } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ConfessionsService } from './confessions.service';
import { getBodyHash } from './utils/confession.util';

describe('ConfessionsService', () => {
  let service: ConfessionsService;
  let prismaMock: {
    getDefaultChurchId: jest.Mock;
    confession: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    confessionAudio: {
      create: jest.Mock;
      findUnique: jest.Mock;
      upsert: jest.Mock;
      delete: jest.Mock;
    };
    confessionReminder: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const adminUser: ActiveUserData = {
    sub: 'user-admin',
    email: 'admin@church.org',
    roles: ['ADMIN'],
    churchId: 'church-1',
  };

  beforeEach(async () => {
    prismaMock = {
      getDefaultChurchId: jest.fn().mockResolvedValue('church-1'),
      confession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      confessionAudio: {
        create: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      confessionReminder: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((promises) => Promise.all(promises)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfessionsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<ConfessionsService>(ConfessionsService);
  });

  describe('findAll', () => {
    it('public list returns only published items in sortOrder, with excerpt, position, wordCount, listenCount, audio, and no body', async () => {
      const mockPublished = [
        {
          id: 'c-1',
          slug: 'first-confession',
          title: 'First Confession',
          body: 'This is the first sentence. And another long text to form body.',
          scriptureRef: 'Psalm 23:1',
          category: 'Peace',
          status: ConfessionStatus.PUBLISHED,
          sortOrder: 0,
          publishedAt: new Date(),
          listenCount: 5,
          createdAt: new Date('2026-01-01'),
          audio: [
            {
              id: 'a-1',
              confessionId: 'c-1',
              voice: ConfessionVoice.FEMALE,
              url: '/public/confession-audio/c-1/female-12345678.mp3',
              durationSec: 45,
              sizeBytes: 1000,
              textHash: 'hash1',
            },
          ],
        },
      ];

      // Published lookup for position
      prismaMock.confession.findMany
        .mockResolvedValueOnce([{ id: 'c-1' }]) // for positionMap
        .mockResolvedValueOnce(mockPublished); // for items
      prismaMock.confession.count.mockResolvedValueOnce(1);

      const result = await service.findAll({});

      expect(prismaMock.confession.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: ConfessionStatus.PUBLISHED,
            churchId: 'church-1',
          }),
        }),
      );

      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.id).toBe('c-1');
      expect(item.slug).toBe('first-confession');
      expect(item.title).toBe('First Confession');
      expect(item.excerpt).toBeDefined();
      expect(item.position).toBe(1);
      expect(item.wordCount).toBeGreaterThan(0);
      expect(item.listenCount).toBe(5);
      expect(item.audio).toEqual({
        female: {
          url: '/public/confession-audio/c-1/female-12345678.mp3',
          durationSec: 45,
        },
      });
      // Ensure body is not included in list item
      expect((item as unknown as Record<string, unknown>).body).toBeUndefined();
      // Ensure audioStale is NOT present for public caller
      expect(item.audioStale).toBeUndefined();
    });

    it('admin caller receives both published and draft items, and receives audioStale', async () => {
      const mockItems = [
        {
          id: 'c-1',
          slug: 'published-one',
          title: 'Published One',
          body: 'Original body',
          scriptureRef: null,
          category: null,
          status: ConfessionStatus.PUBLISHED,
          sortOrder: 0,
          publishedAt: new Date(),
          listenCount: 1,
          createdAt: new Date('2026-01-01'),
          audio: [
            {
              id: 'a-1',
              confessionId: 'c-1',
              voice: ConfessionVoice.FEMALE,
              url: '/public/confession-audio/c-1/female-123.mp3',
              durationSec: 30,
              sizeBytes: 500,
              textHash: getBodyHash('Different body'), // stale!
            },
          ],
        },
        {
          id: 'c-2',
          slug: 'draft-one',
          title: 'Draft One',
          body: 'Draft body',
          scriptureRef: null,
          category: null,
          status: ConfessionStatus.DRAFT,
          sortOrder: 1,
          publishedAt: null,
          listenCount: 0,
          createdAt: new Date('2026-01-02'),
          audio: [],
        },
      ];

      prismaMock.confession.findMany
        .mockResolvedValueOnce([{ id: 'c-1' }]) // published list for position
        .mockResolvedValueOnce(mockItems);
      prismaMock.confession.count.mockResolvedValueOnce(2);

      const result = await service.findAll({}, adminUser);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].position).toBe(1);
      expect(result.items[0].audioStale).toEqual({ female: true });
      expect(result.items[1].position).toBeNull(); // Draft position is null
      expect(result.items[1].audioStale).toEqual({});
    });

    it('rejects public request with limit > 100 with BadRequestException', async () => {
      await expect(service.findAll({ limit: 101 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows admin request with limit up to 200', async () => {
      prismaMock.confession.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prismaMock.confession.count.mockResolvedValueOnce(0);

      const result = await service.findAll({ limit: 200 }, adminUser);
      expect(result.meta.limit).toBe(200);
    });
  });

  describe('position numbering', () => {
    it('position numbers published items 1..n and skips drafts; position is null for drafts', async () => {
      const allPublishedInChurch = [{ id: 'pub-1' }, { id: 'pub-2' }];

      const queriedItems = [
        {
          id: 'pub-1',
          slug: 'pub-1',
          title: 'Pub 1',
          body: 'Text 1',
          status: ConfessionStatus.PUBLISHED,
          sortOrder: 0,
          audio: [],
        },
        {
          id: 'draft-1',
          slug: 'draft-1',
          title: 'Draft 1',
          body: 'Draft Text',
          status: ConfessionStatus.DRAFT,
          sortOrder: 1,
          audio: [],
        },
        {
          id: 'pub-2',
          slug: 'pub-2',
          title: 'Pub 2',
          body: 'Text 2',
          status: ConfessionStatus.PUBLISHED,
          sortOrder: 2,
          audio: [],
        },
      ];

      prismaMock.confession.findMany
        .mockResolvedValueOnce(allPublishedInChurch)
        .mockResolvedValueOnce(queriedItems);
      prismaMock.confession.count.mockResolvedValueOnce(3);

      const result = await service.findAll({}, adminUser);
      expect(result.items[0].position).toBe(1);
      expect(result.items[1].position).toBeNull();
      expect(result.items[2].position).toBe(2);
    });
  });

  describe('findOne (previous and next neighbours & drafts check)', () => {
    it('previous and next follow the order and skip drafts', async () => {
      const publishedList = [
        {
          id: 'c-1',
          slug: 'slug-1',
          title: 'Title 1',
          sortOrder: 0,
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'c-3',
          slug: 'slug-3',
          title: 'Title 3',
          sortOrder: 2,
          createdAt: new Date('2026-01-03'),
        },
      ];

      // Request c-3 (middle draft c-2 exists at sortOrder 1, so c-3 previous should be c-1)
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-3',
        slug: 'slug-3',
        title: 'Title 3',
        body: 'Body 3',
        scriptureRef: null,
        category: null,
        status: ConfessionStatus.PUBLISHED,
        sortOrder: 2,
        publishedAt: new Date(),
        listenCount: 0,
        churchId: 'church-1',
        audio: [],
      });
      prismaMock.confession.findMany.mockResolvedValueOnce(publishedList);

      const result = await service.findOne('slug-3');
      expect(result.position).toBe(2);
      expect(result.previous).toEqual({ slug: 'slug-1', title: 'Title 1' });
      expect(result.next).toBeNull();
      expect(result.body).toBe('Body 3');
    });

    it('returns 404 for a public GET requesting a draft', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-draft',
        slug: 'draft-confession',
        title: 'Draft',
        body: 'Draft body',
        status: ConfessionStatus.DRAFT,
        churchId: 'church-1',
        audio: [],
      });

      await expect(service.findOne('draft-confession')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 for a confession from another church', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-other',
        slug: 'other-church-confession',
        status: ConfessionStatus.PUBLISHED,
        churchId: 'church-2', // caller resolves to church-1
        audio: [],
      });

      await expect(service.findOne('other-church-confession')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create and slug generation', () => {
    it('creates confession and automatically generates slug from title with clash resolution (-2, -3)', async () => {
      // First findUnique for slug check
      prismaMock.confession.findFirst
        .mockResolvedValueOnce({ id: 'existing-1' }) // 'my-title' taken
        .mockResolvedValueOnce(null); // 'my-title-2' available

      prismaMock.confession.findFirst.mockResolvedValueOnce({ sortOrder: 5 }); // for max sortOrder

      const createdRecord = {
        id: 'new-id',
        churchId: 'church-1',
        title: 'My Title!',
        slug: 'my-title-2',
        body: 'My body text',
        scriptureRef: null,
        category: null,
        status: ConfessionStatus.DRAFT,
        sortOrder: 6,
        publishedAt: null,
        listenCount: 0,
        audio: [],
      };

      prismaMock.confession.create.mockResolvedValueOnce(createdRecord);
      prismaMock.confession.findUnique.mockResolvedValueOnce(createdRecord);
      prismaMock.confession.findMany.mockResolvedValueOnce([]); // for published

      const result = await service.create(
        {
          title: 'My Title!',
          body: 'My body text',
        },
        adminUser,
      );

      expect(prismaMock.confession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'my-title-2',
            sortOrder: 6,
            churchId: 'church-1',
          }),
        }),
      );
      expect(result.id).toBe('new-id');
    });

    it('rejects taken custom slug with 409 Conflict', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'existing-id',
      });

      await expect(
        service.create(
          {
            title: 'Custom Title',
            slug: 'custom-slug',
            body: 'Body text',
          },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('reuses existing category casing case-insensitively', async () => {
      prismaMock.confession.findFirst
        .mockResolvedValueOnce(null) // slug available
        .mockResolvedValueOnce(null); // sortOrder 0

      prismaMock.confession.findMany.mockResolvedValueOnce([
        { category: 'Healing' },
      ]);

      const createdRecord = {
        id: 'new-id',
        churchId: 'church-1',
        title: 'Healing Confession',
        slug: 'healing-confession',
        body: 'Body text',
        category: 'Healing',
        status: ConfessionStatus.DRAFT,
        sortOrder: 0,
        audio: [],
      };
      prismaMock.confession.create.mockResolvedValueOnce(createdRecord);
      prismaMock.confession.findUnique.mockResolvedValueOnce(createdRecord);
      prismaMock.confession.findMany.mockResolvedValueOnce([]);

      await service.create(
        {
          title: 'Healing Confession',
          body: 'Body text',
          category: 'healing', // lowercase input
        },
        adminUser,
      );

      expect(prismaMock.confession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'Healing', // preserved casing
          }),
        }),
      );
    });

    it('requires non-empty title and body when creating directly as PUBLISHED', async () => {
      await expect(
        service.create(
          {
            title: '   ',
            body: 'Body',
            status: ConfessionStatus.PUBLISHED,
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('editing a record does not change sortOrder', async () => {
      const existing = {
        id: 'c-1',
        churchId: 'church-1',
        title: 'Old Title',
        slug: 'old-title',
        body: 'Old Body',
        scriptureRef: null,
        category: null,
        status: ConfessionStatus.DRAFT,
        sortOrder: 3,
        publishedAt: null,
        audio: [],
      };

      prismaMock.confession.findUnique.mockResolvedValueOnce(existing);
      prismaMock.confession.update.mockResolvedValueOnce({
        ...existing,
        title: 'New Title',
      });
      // For findOne return
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        ...existing,
        title: 'New Title',
      });
      prismaMock.confession.findMany.mockResolvedValueOnce([]);

      await service.update('c-1', { title: 'New Title' }, adminUser);

      // Verify update did not pass sortOrder
      expect(prismaMock.confession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c-1' },
          data: expect.not.objectContaining({ sortOrder: expect.anything() }),
        }),
      );
    });

    it('sets publishedAt on first transition to PUBLISHED and keeps it on republish', async () => {
      const existing = {
        id: 'c-1',
        churchId: 'church-1',
        title: 'Title',
        slug: 'title',
        body: 'Body',
        status: ConfessionStatus.DRAFT,
        publishedAt: null,
        sortOrder: 0,
        audio: [],
      };

      prismaMock.confession.findUnique.mockResolvedValueOnce(existing);
      prismaMock.confession.update.mockResolvedValueOnce({
        ...existing,
        status: ConfessionStatus.PUBLISHED,
        publishedAt: new Date(),
      });
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        ...existing,
        status: ConfessionStatus.PUBLISHED,
        publishedAt: new Date(),
      });
      prismaMock.confession.findMany.mockResolvedValueOnce([]);

      await service.update(
        'c-1',
        { status: ConfessionStatus.PUBLISHED },
        adminUser,
      );

      expect(prismaMock.confession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ConfessionStatus.PUBLISHED,
            publishedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('reorder', () => {
    it('sets sortOrder to each id index in one transaction', async () => {
      prismaMock.confession.findMany.mockResolvedValueOnce([
        { id: 'c-1' },
        { id: 'c-2' },
        { id: 'c-3' },
      ]);

      const result = await service.reorder(
        { ids: ['c-3', 'c-1', 'c-2'] },
        adminUser,
      );

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result).toEqual({ reordered: 3 });
    });

    it('reorder rejects missing, duplicated, and unknown ids with 400 Bad Request', async () => {
      // Duplicated
      await expect(
        service.reorder({ ids: ['c-1', 'c-1'] }, adminUser),
      ).rejects.toThrow(BadRequestException);

      // Missing some church ids
      prismaMock.confession.findMany.mockResolvedValueOnce([
        { id: 'c-1' },
        { id: 'c-2' },
      ]);
      await expect(
        service.reorder({ ids: ['c-1'] }, adminUser),
      ).rejects.toThrow(BadRequestException);

      // Unknown id
      prismaMock.confession.findMany.mockResolvedValueOnce([
        { id: 'c-1' },
        { id: 'c-2' },
      ]);
      await expect(
        service.reorder({ ids: ['c-1', 'c-999'] }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordListen', () => {
    it('increments listenCount atomically and returns void for published default-church confession', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
        status: ConfessionStatus.PUBLISHED,
      });

      await service.recordListen('c-1');

      expect(prismaMock.confession.update).toHaveBeenCalledWith({
        where: { id: 'c-1' },
        data: { listenCount: { increment: 1 } },
      });
    });

    it('returns 404 for draft confession', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-draft',
        churchId: 'church-1',
        status: ConfessionStatus.DRAFT,
      });

      await expect(service.recordListen('c-draft')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns 404 for confession belonging to non-default church', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-other',
        churchId: 'church-2',
        status: ConfessionStatus.PUBLISHED,
      });

      await expect(service.recordListen('c-other')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Confession Reminders', () => {
    it('returns formatted reminders list for valid confession', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce({
        id: 'c-1',
        churchId: 'church-1',
      });
      prismaMock.confessionReminder.findMany.mockResolvedValueOnce([
        {
          id: 'rem-1',
          confessionId: 'c-1',
          timeOfDay: '06:30',
          daysOfWeek: [1, 2, 3],
          startsOn: new Date('2026-11-01T00:00:00.000Z'),
          endsOn: null,
          message: 'Declare your blessings',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getReminders('c-1', adminUser);
      expect(result).toHaveLength(1);
      expect(result[0].timeOfDay).toBe('06:30');
      expect(result[0].startsOn).toBe('2026-11-01');
      expect(result[0].endsOn).toBeNull();
    });

    it('throws NotFoundException for confession not found or different church', async () => {
      prismaMock.confession.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getReminders('c-unknown', adminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('replaces reminders in transaction on updateReminders', async () => {
      prismaMock.confession.findUnique.mockResolvedValue({
        id: 'c-1',
        churchId: 'church-1',
      });
      prismaMock.$transaction.mockImplementation(async (callback) => {
        if (typeof callback === 'function') {
          return callback(prismaMock);
        }
        return Promise.all(callback);
      });
      prismaMock.confessionReminder.deleteMany.mockResolvedValueOnce({
        count: 1,
      });
      prismaMock.confessionReminder.create.mockResolvedValueOnce({});
      prismaMock.confessionReminder.findMany.mockResolvedValueOnce([
        {
          id: 'rem-new',
          confessionId: 'c-1',
          timeOfDay: '07:00',
          daysOfWeek: [],
          startsOn: null,
          endsOn: null,
          message: null,
          createdAt: new Date(),
        },
      ]);

      const result = await service.updateReminders(
        'c-1',
        {
          reminders: [
            {
              timeOfDay: '07:00',
              daysOfWeek: [],
              startsOn: null,
              endsOn: null,
              message: null,
            },
          ],
        },
        adminUser,
      );

      expect(prismaMock.confessionReminder.deleteMany).toHaveBeenCalledWith({
        where: { confessionId: 'c-1' },
      });
      expect(prismaMock.confessionReminder.create).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].timeOfDay).toBe('07:00');
    });
  });
});
