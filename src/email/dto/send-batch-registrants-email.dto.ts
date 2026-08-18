import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegistrationStatus } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class SendBatchRegistrantsEmailDto {
  @ApiPropertyOptional({
    description: 'Specific list of registration IDs to target (optional)',
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  registrationIds?: string[];

  @ApiPropertyOptional({
    description: 'Target all registrants for a specific event ID',
  })
  @IsUUID()
  @IsOptional()
  eventId?: string;

  @ApiPropertyOptional({
    enum: RegistrationStatus,
    description:
      'Filter by registration status (PENDING, CONFIRMED, CHECKED_IN, CANCELLED)',
  })
  @IsEnum(RegistrationStatus)
  @IsOptional()
  status?: RegistrationStatus;

  @ApiPropertyOptional({
    description: 'Filter by assigned team ID',
  })
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({
    description: 'Search string matching attendee name or registration number',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description:
      'Email subject line (supports placeholders e.g. {{firstName}}, {{eventTitle}})',
    example: 'Updates for {{eventTitle}} Attendees',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Optional header banner title',
    example: 'Event Announcement',
  })
  @IsString()
  @IsOptional()
  heading?: string;

  @ApiProperty({
    description:
      'Email message content (supports double line break paragraphs and placeholders)',
    example:
      'Dear {{firstName}},\n\nPlease be reminded of the venue guidelines for {{eventTitle}}.',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button text',
    example: 'View Venue Map',
  })
  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button URL',
    example: 'https://example.org/map',
  })
  @IsUrl()
  @IsOptional()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description:
      'If true, includes event summary card and QR check-in pass for each recipient',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeQrPass?: boolean;
}
