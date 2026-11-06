import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfessionStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { normalizeBody } from '../utils/confession.util';

export class CreateConfessionDto {
  @ApiProperty({
    description: 'Title of the confession',
    maxLength: 150,
    example: 'Confession to Start my Day',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  title: string;

  @ApiPropertyOptional({
    description:
      'Optional custom slug (lowercase letters, digits and hyphens only, 1-160 chars). Generated from title if omitted.',
    maxLength: 160,
    example: 'confession-to-start-my-day',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must contain only lowercase letters, digits, and hyphens',
  })
  @Length(1, 160)
  slug?: string;

  @ApiProperty({
    description:
      'Body text of the confession (plain text, paragraphs separated by blank lines)',
    maxLength: 20000,
    example:
      'I declare that this is the best day of my life yet.\n\nI am on a perpetual cycle of increase.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeBody(value) : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 20000)
  body: string;

  @ApiPropertyOptional({
    description: 'Optional scripture reference',
    maxLength: 100,
    nullable: true,
    example: 'Psalm 118:24',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' && value.trim() === '') return null;
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(100)
  scriptureRef?: string | null;

  @ApiPropertyOptional({
    description: 'Optional category (e.g. Healing, Protection)',
    maxLength: 50,
    nullable: true,
    example: 'Daily',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' && value.trim() === '') return null;
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(50)
  category?: string | null;

  @ApiPropertyOptional({
    description: 'Status of the confession',
    enum: ConfessionStatus,
    default: ConfessionStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ConfessionStatus)
  status?: ConfessionStatus = ConfessionStatus.DRAFT;
}
