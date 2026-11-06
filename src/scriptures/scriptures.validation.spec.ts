import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ScriptureKind, ScriptureStatus } from '@prisma/client';
import { CreateScriptureDto } from './dto/create-scripture.dto';
import { QueryScripturesDto } from './dto/query-scriptures.dto';
import { UpdateScriptureDto } from './dto/update-scripture.dto';
import {
  normalizeScriptureText,
  isValidDateOnlyString,
} from './utils/scripture.util';

describe('Scriptures Validation & DTOs', () => {
  describe('normalizeScriptureText & date util', () => {
    it('normalises CRLF and CR to LF', () => {
      const input = 'Line 1\r\nLine 2\rLine 3';
      expect(normalizeScriptureText(input)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('collapses whitespace around line breaks and trims', () => {
      const input = '   Line 1   \n   Line 2 \t \n  Line 3   ';
      expect(normalizeScriptureText(input)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('validates real dates correctly', () => {
      expect(isValidDateOnlyString('2026-11-09')).toBe(true);
      expect(isValidDateOnlyString('2024-02-29')).toBe(true); // leap year
      expect(isValidDateOnlyString('2026-02-29')).toBe(false); // not leap year
      expect(isValidDateOnlyString('2026-02-31')).toBe(false);
      expect(isValidDateOnlyString('invalid-date')).toBe(false);
      expect(isValidDateOnlyString('')).toBe(false);
      expect(isValidDateOnlyString(null)).toBe(false);
    });
  });

  describe('CreateScriptureDto', () => {
    it('passes with all valid required fields', async () => {
      const plain = {
        kind: ScriptureKind.WEEK,
        text: 'For God so loved the world...',
        reference: 'John 3:16',
        translation: 'NKJV',
        givenBy: 'Rev. Deji Olabode',
        startsOn: '2026-11-09',
        status: ScriptureStatus.PUBLISHED,
      };

      const dto = plainToInstance(CreateScriptureDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.text).toBe('For God so loved the world...');
      expect(dto.reference).toBe('John 3:16');
      expect(dto.translation).toBe('NKJV');
      expect(dto.givenBy).toBe('Rev. Deji Olabode');
      expect(dto.startsOn).toBe('2026-11-09');
      expect(dto.status).toBe(ScriptureStatus.PUBLISHED);
    });

    it('defaults status to DRAFT when omitted', async () => {
      const plain = {
        kind: ScriptureKind.YEAR,
        text: 'Behold, I will do a new thing...',
        reference: 'Isaiah 43:19',
      };

      const dto = plainToInstance(CreateScriptureDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.status).toBe(ScriptureStatus.DRAFT);
    });

    it('transforms empty translation and givenBy to null', async () => {
      const plain = {
        kind: ScriptureKind.WEEK,
        text: 'The Lord is my shepherd',
        reference: 'Psalm 23:1',
        translation: '   ',
        givenBy: '',
      };

      const dto = plainToInstance(CreateScriptureDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.translation).toBeNull();
      expect(dto.givenBy).toBeNull();
    });

    it('rejects missing or invalid kind', async () => {
      const plain = {
        text: 'The Lord is my shepherd',
        reference: 'Psalm 23:1',
      };

      const dto = plainToInstance(CreateScriptureDto, plain);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'kind')).toBe(true);

      const invalidKind = plainToInstance(CreateScriptureDto, {
        ...plain,
        kind: 'MONTH',
      });
      const errors2 = await validate(invalidKind);
      expect(errors2.some((e) => e.property === 'kind')).toBe(true);
    });

    it('rejects empty text or text exceeding 1500 chars', async () => {
      const emptyText = plainToInstance(CreateScriptureDto, {
        kind: ScriptureKind.WEEK,
        text: '   ',
        reference: 'Psalm 23:1',
      });
      const errors1 = await validate(emptyText);
      expect(errors1.some((e) => e.property === 'text')).toBe(true);

      const longText = plainToInstance(CreateScriptureDto, {
        kind: ScriptureKind.WEEK,
        text: 'a'.repeat(1501),
        reference: 'Psalm 23:1',
      });
      const errors2 = await validate(longText);
      expect(errors2.some((e) => e.property === 'text')).toBe(true);
    });

    it('rejects empty reference or reference exceeding 100 chars', async () => {
      const emptyRef = plainToInstance(CreateScriptureDto, {
        kind: ScriptureKind.WEEK,
        text: 'Valid text',
        reference: '   ',
      });
      const errors1 = await validate(emptyRef);
      expect(errors1.some((e) => e.property === 'reference')).toBe(true);

      const longRef = plainToInstance(CreateScriptureDto, {
        kind: ScriptureKind.WEEK,
        text: 'Valid text',
        reference: 'r'.repeat(101),
      });
      const errors2 = await validate(longRef);
      expect(errors2.some((e) => e.property === 'reference')).toBe(true);
    });

    it('rejects invalid startsOn date', async () => {
      const invalidDate = plainToInstance(CreateScriptureDto, {
        kind: ScriptureKind.WEEK,
        text: 'Valid text',
        reference: 'John 1:1',
        startsOn: '2026-02-31',
      });
      const errors = await validate(invalidDate);
      expect(errors.some((e) => e.property === 'startsOn')).toBe(true);
    });
  });

  describe('UpdateScriptureDto', () => {
    it('accepts partial updates', async () => {
      const plain = {
        text: 'Updated verse text',
        status: ScriptureStatus.PUBLISHED,
      };

      const dto = plainToInstance(UpdateScriptureDto, plain);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.text).toBe('Updated verse text');
      expect(dto.status).toBe(ScriptureStatus.PUBLISHED);
    });

    it('validates startsOn format when provided', async () => {
      const invalidDate = plainToInstance(UpdateScriptureDto, {
        startsOn: 'not-a-date',
      });
      const errors = await validate(invalidDate);
      expect(errors.some((e) => e.property === 'startsOn')).toBe(true);
    });
  });

  describe('QueryScripturesDto', () => {
    it('accepts valid query parameters and applies defaults', async () => {
      const dto = plainToInstance(QueryScripturesDto, {
        kind: ScriptureKind.WEEK,
        status: ScriptureStatus.PUBLISHED,
        page: '2',
        limit: '50',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.kind).toBe(ScriptureKind.WEEK);
      expect(dto.status).toBe(ScriptureStatus.PUBLISHED);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(50);
    });

    it('rejects limit exceeding 100', async () => {
      const dto = plainToInstance(QueryScripturesDto, {
        limit: '150',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'limit')).toBe(true);
    });
  });
});
