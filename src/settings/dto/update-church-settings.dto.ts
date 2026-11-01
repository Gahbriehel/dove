import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class UpdateChurchSettingsDto {
  @ApiPropertyOptional({
    description: 'Name of the church',
    example: 'Grace Community Church',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Alias for church name',
    example: 'Grace Community Church',
  })
  @IsOptional()
  @IsString()
  churchName?: string;

  @ApiPropertyOptional({
    description:
      'Short name used in member-facing messages (falls back to the full name when empty)',
    example: 'Amazing Grace',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional({
    description:
      'Church WhatsApp Business number. Stored in E.164 format; any common format is accepted. Send an empty string to clear it.',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  whatsappNumber?: string;

  @ApiPropertyOptional({
    description: 'Campus or branch name',
    example: 'Central Campus',
  })
  @IsOptional()
  @IsString()
  branchName?: string;

  @ApiPropertyOptional({
    description: 'Alias for branch name',
    example: 'Central Campus',
  })
  @IsOptional()
  @IsString()
  campusName?: string;

  @ApiPropertyOptional({
    description: 'Physical address of the church',
    example: '123 Faith Avenue, City, State',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Alias for physical address',
    example: '123 Faith Avenue, City, State',
  })
  @IsOptional()
  @IsString()
  physicalAddress?: string;

  @ApiPropertyOptional({
    description: 'Primary phone number',
    example: '+1-555-019-2834',
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Alias for primary phone number',
    example: '+1-555-019-2834',
  })
  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @ApiPropertyOptional({
    description: 'Official church email address',
    example: 'info@gracechurch.org',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: 'Alias for official email address',
    example: 'info@gracechurch.org',
  })
  @IsOptional()
  @IsEmail()
  officialEmail?: string;

  @ApiPropertyOptional({
    description: 'Church website URL',
    example: 'https://gracechurch.org',
  })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'Alias for website URL',
    example: 'https://gracechurch.org',
  })
  @IsOptional()
  @IsUrl()
  website?: string;
}
