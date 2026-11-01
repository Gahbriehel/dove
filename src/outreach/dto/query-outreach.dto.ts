import { ApiPropertyOptional } from '@nestjs/swagger';
import { OutreachPurpose, OutreachStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryOutreachDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  personId?: string;

  @ApiPropertyOptional({ enum: OutreachPurpose })
  @IsEnum(OutreachPurpose)
  @IsOptional()
  purpose?: OutreachPurpose;

  @ApiPropertyOptional({ enum: OutreachStatus })
  @IsEnum(OutreachStatus)
  @IsOptional()
  status?: OutreachStatus;

  @ApiPropertyOptional({ description: 'Only messages opened by this user' })
  @IsUUID()
  @IsOptional()
  sentByUserId?: string;

  @ApiPropertyOptional({ description: 'Opened on or after (ISO date)' })
  @IsDateString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Opened on or before (ISO date)' })
  @IsDateString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
