import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategory, EventStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiPropertyOptional({
    description:
      'ID of the church hosting the event (optional, inferred automatically if omitted)',
  })
  @IsUUID()
  @IsOptional()
  churchId?: string;

  @ApiProperty({ description: 'Event title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Detailed event description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: EventCategory,
    default: EventCategory.GENERAL,
    description: 'Ministry category for the event',
  })
  @IsEnum(EventCategory)
  @IsOptional()
  category?: EventCategory;

  @ApiPropertyOptional({
    description: 'Event flyer image URL (e.g. uploaded via /uploads/image)',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Whether to enable Google Calendar sync for registrants',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  googleCalendarSync?: boolean;

  @ApiPropertyOptional({
    description: 'Event venue or location',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description:
      'Maximum registration capacity for the event (optional, omitted or null for unlimited capacity / non-registration events)',
    example: 100,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description:
      'Whether online registration and ticket generation are required. If false, admission is free and walk-in friendly.',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  requiresRegistration?: boolean;

  @ApiPropertyOptional({
    description:
      'Key program highlights or bullet points describing what to expect',
    type: [String],
    example: [
      'All-Night Worship',
      'Communion Service',
      'Special Ministrations',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional({
    description:
      'Priority flag to manually pin a specific event to the homepage banner',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({ description: 'Event start date and time (ISO 8601 string)' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({ description: 'Event end date and time (ISO 8601 string)' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    enum: EventStatus,
    default: EventStatus.DRAFT,
    description: 'Current status of the event',
  })
  @IsEnum(EventStatus)
  @IsOptional()
  status?: EventStatus;
}
