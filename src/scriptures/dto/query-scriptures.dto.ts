import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScriptureKind, ScriptureStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryScripturesDto {
  @ApiPropertyOptional({
    description: 'Filter by scripture kind (WEEK or YEAR)',
    enum: ScriptureKind,
  })
  @IsOptional()
  @IsEnum(ScriptureKind)
  kind?: ScriptureKind;

  @ApiPropertyOptional({
    description: 'Filter by publication status (DRAFT or PUBLISHED)',
    enum: ScriptureStatus,
  })
  @IsOptional()
  @IsEnum(ScriptureStatus)
  status?: ScriptureStatus;

  @ApiPropertyOptional({
    description: 'Page number (minimum 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page (maximum 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
