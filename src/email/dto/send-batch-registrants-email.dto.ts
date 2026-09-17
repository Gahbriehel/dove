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
      'Email message content. Accepts either plain text (double line breaks become paragraphs) or rich-text HTML (e.g. from a WYSIWYG editor like Quill) — HTML is sanitized to a safe subset of tags before sending. Supports placeholders.',
    example:
      '<p>Dear {{firstName}},</p><p>Please be reminded of the venue guidelines for {{eventTitle}}.</p>',
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

  @ApiPropertyOptional({
    description:
      'Flyer or announcement image URL (e.g. uploaded via /uploads/image or external URL)',
    example: '/public/uploads/flyer.png',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
