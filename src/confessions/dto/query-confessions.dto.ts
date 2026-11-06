import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConfessionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryConfessionsDto {
  @ApiPropertyOptional({
    description: 'Optional church ID to query confessions for',
  })
  @IsOptional()
  @IsString()
  churchId?: string;

  @ApiPropertyOptional({
    description: 'Filter confessions by status (Admins only)',
    enum: ConfessionStatus,
  })
  @IsOptional()
  @IsEnum(ConfessionStatus)
  status?: ConfessionStatus;

  @ApiPropertyOptional({
    description:
      'Filter confessions by category (case-insensitive exact match)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Search confessions by title or body',
  })
  @IsOptional()
  @IsString()
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
    description:
      'Number of items per page (default 20, max 100 for public, max 200 for admin)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 20;
}
