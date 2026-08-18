import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class SendRegistrantEmailDto {
  @ApiProperty({
    description: 'ID of the registration record',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID()
  @IsNotEmpty()
  registrationId: string;

  @ApiProperty({
    description:
      'Email subject line (supports placeholders e.g. {{firstName}}, {{eventTitle}})',
    example: 'Important Info for {{eventTitle}}, {{firstName}}!',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Optional header banner title',
    example: 'Event Reminder',
  })
  @IsString()
  @IsOptional()
  heading?: string;

  @ApiProperty({
    description:
      'Email message content (supports double line break paragraphs and placeholders)',
    example:
      'Hi {{firstName}},\n\nHere are details for {{eventTitle}} (Pass #: {{registrationNumber}}).',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button text',
    example: 'Event Schedule',
  })
  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button URL',
    example: 'https://example.org/schedule',
  })
  @IsUrl()
  @IsOptional()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description:
      'If true, includes event summary card and QR check-in pass in email',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  includeQrPass?: boolean;
}
