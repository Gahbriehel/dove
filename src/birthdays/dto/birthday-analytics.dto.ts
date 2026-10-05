import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryBirthdayAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Filter analytics by target year (defaults to current year)',
    example: 2026,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @IsOptional()
  year?: number;

  @ApiPropertyOptional({
    description: 'Filter analytics by month (1 - 12)',
    example: 10,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;
}

export class MonthlyBirthdayStatDto {
  @ApiProperty({ example: 1 })
  month: number;

  @ApiProperty({ example: 'January' })
  monthName: string;

  @ApiProperty({ example: 12 })
  total: number;

  @ApiProperty({ example: 10 })
  completed: number;

  @ApiProperty({ example: 1 })
  pending: number;

  @ApiProperty({ example: 1 })
  missed: number;

  @ApiProperty({ example: 83.33 })
  handlingRate: number;
}

export class BirthdayAnalyticsResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiPropertyOptional({ example: 10 })
  month?: number;

  @ApiProperty({
    description: 'Total birthdays recorded in this period',
    example: 120,
  })
  totalBirthdays: number;

  @ApiProperty({ description: 'Total greetings completed/sent', example: 95 })
  completedCount: number;

  @ApiProperty({
    description: 'Total birthdays pending outreach (today/upcoming)',
    example: 15,
  })
  pendingCount: number;

  @ApiProperty({
    description: 'Total birthdays missed without greeting',
    example: 10,
  })
  missedCount: number;

  @ApiProperty({
    description: 'Handling rate percentage (completed / total * 100)',
    example: 79.17,
  })
  handlingRate: number;

  @ApiProperty({ type: [MonthlyBirthdayStatDto] })
  monthlyBreakdown: MonthlyBirthdayStatDto[];
}
