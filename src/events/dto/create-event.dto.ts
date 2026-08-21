import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import {
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
      'Maximum registration capacity for the event (optional, omitted or null for unlimited capacity)',
    example: 100,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

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
