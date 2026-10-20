import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInReason, CheckInStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryCheckInDto {
  @ApiPropertyOptional({ description: 'Filter by church ID' })
  @IsUUID()
  @IsOptional()
  churchId?: string;

  @ApiPropertyOptional({
    description: 'Filter check-ins for a specific person',
  })
  @IsUUID()
  @IsOptional()
  personId?: string;

  @ApiPropertyOptional({
    description: 'Filter check-ins assigned to a specific user/staff member',
  })
  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status (SCHEDULED, COMPLETED, CANCELLED)',
    enum: CheckInStatus,
  })
  @IsEnum(CheckInStatus)
  @IsOptional()
  status?: CheckInStatus;

  @ApiPropertyOptional({
    description: 'Filter by reason category',
    enum: CheckInReason,
  })
  @IsEnum(CheckInReason)
  @IsOptional()
  reason?: CheckInReason;

  @ApiPropertyOptional({
    description: 'Search across notes and outcome text',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
