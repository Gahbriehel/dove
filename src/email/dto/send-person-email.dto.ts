import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class SendPersonEmailDto {
  @ApiProperty({
    description: 'ID of the person recipient',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @ApiProperty({
    description:
      'Email subject line (supports placeholders e.g. {{firstName}})',
    example: 'Hello {{firstName}}, an update from our church!',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Optional header banner title',
    example: 'Special Announcement',
  })
  @IsString()
  @IsOptional()
  heading?: string;

  @ApiProperty({
    description:
      'Email message content. Accepts either plain text (double line breaks become paragraphs) or rich-text HTML (e.g. from a WYSIWYG editor like Quill) — HTML is sanitized to a safe subset of tags before sending. Supports placeholders.',
    example:
      '<p>Hi {{firstName}},</p><p>We are glad to have you in our community.</p>',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button text',
    example: 'Visit Website',
  })
  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button URL',
    example: 'https://example.org',
  })
  @IsUrl()
  @IsOptional()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description:
      'Flyer or announcement image URL (e.g. uploaded via /uploads/image or external URL)',
    example: '/public/uploads/flyer.png',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
