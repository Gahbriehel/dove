import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInReason, CheckInStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateCheckInDto {
  @ApiProperty({
    description: 'UUID of the person being checked in on',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({
    description: 'Category/reason for the pastoral check-in',
    enum: CheckInReason,
    default: CheckInReason.GENERAL_CHECK_IN,
  })
  @IsEnum(CheckInReason)
  @IsOptional()
  reason?: CheckInReason = CheckInReason.GENERAL_CHECK_IN;

  @ApiPropertyOptional({
    description: 'Current status of the check-in',
    enum: CheckInStatus,
    default: CheckInStatus.SCHEDULED,
  })
  @IsEnum(CheckInStatus)
  @IsOptional()
  status?: CheckInStatus = CheckInStatus.SCHEDULED;

  @ApiPropertyOptional({
    description: 'UUID of the staff/leader assigned to conduct the check-in',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Scheduled date/time for the check-in (ISO string)',
    example: '2026-10-25T10:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  scheduledFor?: string;

  @ApiPropertyOptional({
    description:
      'Completion date/time if logging an already-completed check-in (ISO string)',
    example: '2026-10-20T14:30:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  completedAt?: string;

  @ApiPropertyOptional({
    description: 'Context notes or instructions for the check-in',
    example:
      'Missed Sunday service 2 weeks in a row. Reach out to see if all is well.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Summary of the outcome or conversation results',
    example:
      'Spoke on the phone. Was traveling for work; will attend this Sunday.',
  })
  @IsString()
  @IsOptional()
  outcome?: string;
}
