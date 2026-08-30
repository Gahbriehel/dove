import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class QueryContactSubmissionDto {
  @ApiPropertyOptional({
    description: 'Filter by submission type',
    enum: ['prayer', 'inquiry'],
  })
  @IsIn(['prayer', 'inquiry'], {
    message: 'type must be either "prayer" or "inquiry"',
  })
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by category name' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Search by name, email, phone, or message',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by Church ID (Super Admin only)',
  })
  @IsUUID()
  @IsOptional()
  churchId?: string;

  @ApiPropertyOptional({ default: 1, description: 'Page number' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 10, description: 'Items per page' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
