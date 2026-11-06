import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScriptureKind, ScriptureStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly, normalizeScriptureText } from '../utils/scripture.util';

export class CreateScriptureDto {
  @ApiProperty({
    description: 'Kind of scripture (WEEK or YEAR)',
    enum: ScriptureKind,
    example: ScriptureKind.WEEK,
  })
  @IsEnum(ScriptureKind)
  kind: ScriptureKind;

  @ApiProperty({
    description: 'Plain scripture text (1-1500 chars)',
    maxLength: 1500,
    example:
      'Then he said, I will make all my goodness pass before you, and I will proclaim the name of the Lord before you…',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeScriptureText(value) : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1500)
  text: string;

  @ApiProperty({
    description: 'Scripture reference (1-100 chars)',
    maxLength: 100,
    example: 'Exodus 33:19',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  reference: string;

  @ApiPropertyOptional({
    description: 'Bible translation abbreviation (max 20 chars)',
    maxLength: 20,
    example: 'NKJV',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(20)
  translation?: string | null;

  @ApiPropertyOptional({
    description: 'Minister who gave the word (max 100 chars)',
    maxLength: 100,
    example: 'Rev. Deji Olabode',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    return value;
  })
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(100)
  givenBy?: string | null;

  @ApiPropertyOptional({
    description: 'First calendar date it is current (YYYY-MM-DD)',
    example: '2026-11-09',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsDateOnly()
  startsOn?: string;

  @ApiPropertyOptional({
    description: 'Scripture publication status',
    enum: ScriptureStatus,
    default: ScriptureStatus.DRAFT,
    example: ScriptureStatus.PUBLISHED,
  })
  @IsOptional()
  @IsEnum(ScriptureStatus)
  status?: ScriptureStatus = ScriptureStatus.DRAFT;
}
