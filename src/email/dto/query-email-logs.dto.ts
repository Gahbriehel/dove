import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum EmailLogTypeFilter {
  ALL = 'ALL',
  CUSTOM_BROADCAST = 'CUSTOM_BROADCAST',
  REGISTRATION_CONFIRMATION = 'REGISTRATION_CONFIRMATION',
  ADMIN_WELCOME = 'ADMIN_WELCOME',
  BIRTHDAY_GREETING = 'BIRTHDAY_GREETING',
}

export enum EmailLogDeliveryStatusFilter {
  ALL = 'ALL',
  DELIVERABLE = 'DELIVERABLE',
  BOUNCED = 'BOUNCED',
}

export class QueryEmailLogsDto {
  @ApiPropertyOptional({
    description: 'Filter by email type',
    enum: EmailLogTypeFilter,
    default: EmailLogTypeFilter.ALL,
  })
  @IsEnum(EmailLogTypeFilter)
  @IsOptional()
  emailType?: EmailLogTypeFilter = EmailLogTypeFilter.ALL;

  @ApiPropertyOptional({
    description: 'Filter by delivery status (DELIVERABLE or BOUNCED)',
    enum: EmailLogDeliveryStatusFilter,
    default: EmailLogDeliveryStatusFilter.ALL,
  })
  @IsEnum(EmailLogDeliveryStatusFilter)
  @IsOptional()
  deliveryStatus?: EmailLogDeliveryStatusFilter =
    EmailLogDeliveryStatusFilter.ALL;

  @ApiPropertyOptional({
    description:
      'Search term matching recipient name, recipient email, or subject',
    example: 'john@example.com',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter sends created on or after this ISO date',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter sends created on or before this ISO date',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by associated person ID',
    example: 'uuid-1234',
  })
  @IsString()
  @IsOptional()
  personId?: string;

  @ApiPropertyOptional({
    description: 'Filter by associated user ID',
    example: 'uuid-5678',
  })
  @IsString()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by associated registration ID',
    example: 'uuid-9012',
  })
  @IsString()
  @IsOptional()
  registrationId?: string;

  @ApiPropertyOptional({
    description: 'Filter by ID of the admin/user who dispatched the email',
    example: 'uuid-admin-3456',
  })
  @IsString()
  @IsOptional()
  sentByUserId?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
