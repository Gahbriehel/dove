import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryEmailBounceAnalyticsDto {
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

  @ApiPropertyOptional({
    description:
      'Filter analytics by email type (e.g. REGISTRATION_CONFIRMATION, ADMIN_WELCOME, CUSTOM_BROADCAST)',
    example: 'REGISTRATION_CONFIRMATION',
  })
  @IsString()
  @IsOptional()
  emailType?: string;

  @ApiPropertyOptional({
    description: 'Filter analytics by recipient type (e.g. PERSON, USER)',
    example: 'PERSON',
  })
  @IsString()
  @IsOptional()
  recipientType?: string;
}

export class EmailBounceSummaryDto {
  @ApiProperty({
    description: 'Total outbound emails sent in this period',
    example: 1250,
  })
  totalSent: number;

  @ApiProperty({
    description: 'Total bounce and delivery failure events recorded',
    example: 25,
  })
  totalBounces: number;

  @ApiProperty({
    description: 'Total bounce alerts that have been remediated or resolved',
    example: 20,
  })
  resolvedBounces: number;

  @ApiProperty({
    description: 'Total bounce alerts pending remediation/resolution',
    example: 5,
  })
  unresolvedBounces: number;

  @ApiProperty({
    description:
      'Overall bounce rate percentage (totalBounces / totalSent * 100)',
    example: 2.0,
  })
  bounceRate: number;

  @ApiProperty({
    description:
      'Resolution rate percentage of bounced emails (resolvedBounces / totalBounces * 100)',
    example: 80.0,
  })
  resolutionRate: number;

  @ApiProperty({
    description: 'Estimated email delivery rate percentage',
    example: 98.0,
  })
  deliveryRate: number;
}

export class BreakdownItemDto {
  @ApiProperty({ example: 'Hard' })
  category: string;

  @ApiProperty({ example: 18 })
  count: number;

  @ApiProperty({ example: 72.0 })
  percentage: number;
}

export class MonthlyBounceStatDto {
  @ApiProperty({ example: 1 })
  month: number;

  @ApiProperty({ example: 'January' })
  monthName: string;

  @ApiProperty({ example: 150 })
  sentCount: number;

  @ApiProperty({ example: 3 })
  bounceCount: number;

  @ApiProperty({ example: 2 })
  resolvedCount: number;

  @ApiProperty({ example: 1 })
  unresolvedCount: number;

  @ApiProperty({ example: 2.0 })
  bounceRate: number;
}

export class DomainStatDto {
  @ApiProperty({ example: 'gmail.com' })
  domain: string;

  @ApiProperty({ example: 12 })
  count: number;
}

export class EmailBounceAnalyticsResponseDto {
  @ApiProperty({ example: 2026 })
  year: number;

  @ApiPropertyOptional({ example: 10 })
  month?: number;

  @ApiProperty({ type: EmailBounceSummaryDto })
  summary: EmailBounceSummaryDto;

  @ApiProperty({ type: [BreakdownItemDto] })
  byEventType: BreakdownItemDto[];

  @ApiProperty({ type: [BreakdownItemDto] })
  byBounceType: BreakdownItemDto[];

  @ApiProperty({ type: [BreakdownItemDto] })
  byEmailType: BreakdownItemDto[];

  @ApiProperty({ type: [BreakdownItemDto] })
  byRecipientType: BreakdownItemDto[];

  @ApiProperty({ type: [MonthlyBounceStatDto] })
  monthlyTrend: MonthlyBounceStatDto[];

  @ApiProperty({ type: [DomainStatDto] })
  topFailingDomains: DomainStatDto[];
}
