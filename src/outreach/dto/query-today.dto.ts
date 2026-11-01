import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { TODAY_DEFAULT_LIMIT, TODAY_MAX_LIMIT } from '../outreach.constants';

export class QueryTodayDto {
  @ApiPropertyOptional({
    description: 'Maximum items returned per list',
    default: TODAY_DEFAULT_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TODAY_MAX_LIMIT)
  @IsOptional()
  limit?: number = TODAY_DEFAULT_LIMIT;
}
