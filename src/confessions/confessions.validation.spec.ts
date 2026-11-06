/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ValidationPipe } from '@nestjs/common';
import { ConfessionStatus } from '@prisma/client';
import { CreateConfessionDto } from './dto/create-confession.dto';
import { QueryConfessionsDto } from './dto/query-confessions.dto';
import { ReorderConfessionsDto } from './dto/reorder-confessions.dto';
import { UpdateConfessionDto } from './dto/update-confession.dto';
import { normalizeBody } from './utils/confession.util';

describe('Confessions DTO Validation', () => {
  const target = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });

  describe('CreateConfessionDto', () => {
    const validDto = {
      title: 'Confession to Start my Day',
      body: 'I declare that this is the best day of my life yet.\n\nI am on a perpetual cycle of increase.',
      scriptureRef: 'Psalm 118:24',
      category: 'Daily',
      status: ConfessionStatus.DRAFT,
    };

    it('passes with valid input', async () => {
      const result = await target.transform(validDto, {
        type: 'body',
        metatype: CreateConfessionDto,
      });
      expect(result.title).toBe('Confession to Start my Day');
      expect(result.status).toBe(ConfessionStatus.DRAFT);
    });

    it('trims title and normalizes body', async () => {
      const result = await target.transform(
        {
          ...validDto,
          title: '   Trimmed Title   ',
          body: 'Line 1\r\n\r\n\r\n\r\nLine 2',
        },
        { type: 'body', metatype: CreateConfessionDto },
      );
      expect(result.title).toBe('Trimmed Title');
      expect(result.body).toBe('Line 1\n\nLine 2');
    });

    it('accepts valid slug and validates slug regex (lowercase, numbers, hyphens)', async () => {
      const result = await target.transform(
        {
          ...validDto,
          slug: 'valid-slug-123',
        },
        { type: 'body', metatype: CreateConfessionDto },
      );
      expect(result.slug).toBe('valid-slug-123');

      // Invalid slug (uppercase or punctuation)
      await expect(
        target.transform(
          {
            ...validDto,
            slug: 'Invalid Slug!',
          },
          { type: 'body', metatype: CreateConfessionDto },
        ),
      ).rejects.toThrow();
    });

    it('stores empty scriptureRef and category as null', async () => {
      const result = await target.transform(
        {
          ...validDto,
          scriptureRef: '   ',
          category: '   ',
        },
        { type: 'body', metatype: CreateConfessionDto },
      );
      expect(result.scriptureRef).toBeNull();
      expect(result.category).toBeNull();
    });

    it('rejects unknown properties (whitelist & forbidNonWhitelisted)', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            sortOrder: 5, // forbidden
          },
          { type: 'body', metatype: CreateConfessionDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects title longer than 150 characters', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            title: 'a'.repeat(151),
          },
          { type: 'body', metatype: CreateConfessionDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects empty title or empty body', async () => {
      await expect(
        target.transform(
          {
            ...validDto,
            title: '   ',
          },
          { type: 'body', metatype: CreateConfessionDto },
        ),
      ).rejects.toThrow();

      await expect(
        target.transform(
          {
            ...validDto,
            body: '   ',
          },
          { type: 'body', metatype: CreateConfessionDto },
        ),
      ).rejects.toThrow();
    });
  });

  describe('UpdateConfessionDto', () => {
    it('rejects sortOrder if passed directly in update body', async () => {
      await expect(
        target.transform(
          {
            sortOrder: 1,
          },
          { type: 'body', metatype: UpdateConfessionDto },
        ),
      ).rejects.toThrow();
    });

    it('allows partial updates with valid fields', async () => {
      const result = await target.transform(
        {
          title: 'Updated Title',
        },
        { type: 'body', metatype: UpdateConfessionDto },
      );
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('ReorderConfessionsDto', () => {
    it('passes with unique non-empty string IDs', async () => {
      const result = await target.transform(
        {
          ids: ['id-1', 'id-2', 'id-3'],
        },
        { type: 'body', metatype: ReorderConfessionsDto },
      );
      expect(result.ids).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('rejects empty array', async () => {
      await expect(
        target.transform(
          {
            ids: [],
          },
          { type: 'body', metatype: ReorderConfessionsDto },
        ),
      ).rejects.toThrow();
    });

    it('rejects duplicates in array', async () => {
      await expect(
        target.transform(
          {
            ids: ['id-1', 'id-1'],
          },
          { type: 'body', metatype: ReorderConfessionsDto },
        ),
      ).rejects.toThrow();
    });
  });

  describe('QueryConfessionsDto', () => {
    it('accepts limit up to 200', async () => {
      const result = await target.transform(
        {
          limit: 200,
          page: 1,
        },
        { type: 'query', metatype: QueryConfessionsDto },
      );
      expect(result.limit).toBe(200);
      expect(result.page).toBe(1);
    });

    it('rejects limit over 200', async () => {
      await expect(
        target.transform(
          {
            limit: 201,
          },
          { type: 'query', metatype: QueryConfessionsDto },
        ),
      ).rejects.toThrow();
    });
  });

  describe('Body Normalization Utility', () => {
    it('normalises line endings and collapses three or more blank lines into one', () => {
      const input =
        'First Paragraph.\r\n\r\n\r\n\r\n\r\nSecond Paragraph.\r\nThird line.';
      const output = normalizeBody(input);
      expect(output).toBe('First Paragraph.\n\nSecond Paragraph.\nThird line.');
    });
  });
});
