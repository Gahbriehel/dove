import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsDateOnly } from '../../scriptures/utils/scripture.util';

export class CreateNightPrayerExceptionDto {
  @ApiProperty({
    description: 'The Lagos calendar date being changed (YYYY-MM-DD)',
    example: '2026-11-12',
  })
  @IsNotEmpty()
  @IsDateOnly()
  date: string;

  @ApiPropertyOptional({
    description: 'Whether the prayer session on this date is cancelled',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  cancelled?: boolean = true;

  @ApiPropertyOptional({
    description:
      'Optional note displayed on the PWA card (e.g. "Back tomorrow, God bless you")',
    maxLength: 255,
    example: 'No prayer tonight. Back tomorrow, God bless you.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string | null;
}
