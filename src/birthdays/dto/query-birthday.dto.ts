import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum BirthdayStatusFilter {
  ALL = 'ALL',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  MISSED = 'MISSED',
}

export class QueryBirthdayDto {
  @ApiPropertyOptional({
    description: 'Filter by target year (defaults to current calendar year)',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({
    description: 'Filter by birth month (1 - 12)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({
    description: 'Filter by greeting status',
    enum: BirthdayStatusFilter,
    default: BirthdayStatusFilter.ALL,
  })
  @IsEnum(BirthdayStatusFilter)
  @IsOptional()
  status?: BirthdayStatusFilter = BirthdayStatusFilter.ALL;

  @ApiPropertyOptional({
    description: 'Search by first name, last name, or email',
    example: 'John',
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

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 50;
}
