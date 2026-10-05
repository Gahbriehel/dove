import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SendBirthdayGreetingDto {
  @ApiProperty({
    description: 'ID of the person recipient',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({
    description: 'Birthday cycle year (defaults to current cycle year)',
    example: 2026,
  })
  @IsInt()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiProperty({
    description:
      'Email subject line (supports placeholders e.g. {{firstName}}, {{fullName}}, {{turningAge}})',
    example: 'Happy Birthday {{firstName}}! 🎂 Celebrating You Today!',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Optional heading banner title for the email',
    example: 'Happy Birthday!',
  })
  @IsString()
  @IsOptional()
  heading?: string;

  @ApiProperty({
    description:
      'Birthday greeting message content. Accepts plain text or rich HTML. Supports placeholders.',
    example:
      '<p>Dear {{firstName}},</p><p>Wishing you a blessed birthday! May this new year bring joy, peace, and abundance.</p>',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description:
      'Flyer or birthday card image URL (e.g. uploaded via /api/v1/uploads/image or external URL)',
    example: '/public/uploads/birthday-card.png',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button text',
    example: 'Visit Church Website',
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
}
