import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PutNightPrayerDto {
  @ApiProperty({
    description: 'Title of the Night Prayer session',
    maxLength: 150,
    example: 'Night Prayer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional({
    description: 'Description of the Night Prayer session',
    example: 'Join us every night as we end the day in prayer.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Uploaded flyer / banner image URL',
    maxLength: 512,
    example: '/public/uploads/night-prayer.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string | null;

  @ApiProperty({
    description:
      'Google Meet meeting URL (must begin with https://meet.google.com/)',
    example: 'https://meet.google.com/abc-defg-hij',
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  @Matches(/^https:\/\/meet\.google\.com\/[a-z0-9-]+$/i, {
    message:
      'meetUrl must be a valid Google Meet link (https://meet.google.com/...)',
  })
  meetUrl: string;

  @ApiProperty({
    description: 'Time of day in HH:mm format (Africa/Lagos timezone)',
    example: '22:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'timeOfDay must be in HH:mm format (00:00 to 23:59)',
  })
  timeOfDay: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes (15 to 240)',
    default: 60,
    minimum: 15,
    maximum: 240,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(240)
  durationMin?: number = 60;

  @ApiPropertyOptional({
    description:
      'Minutes before start time that the Join button activates (0 to 60)',
    default: 10,
    minimum: 0,
    maximum: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  joinOpensMinBefore?: number = 10;

  @ApiProperty({
    description:
      'Days of week the prayer occurs (0 = Sunday .. 6 = Saturday). Empty list is rejected.',
    example: [0, 1, 2, 3, 4, 5, 6],
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty({
    message: 'daysOfWeek cannot be empty; use isActive: false instead',
  })
  @ArrayUnique({ message: 'daysOfWeek must not contain duplicate days' })
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @ApiPropertyOptional({
    description:
      'Minutes before start time to send reminders (max 3 values, 5 to 720 min). Empty list means on-time only.',
    example: [60],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3, {
    message: 'reminderOffsetsMin allows at most 3 values',
  })
  @ArrayUnique({
    message: 'reminderOffsetsMin must not contain duplicate values',
  })
  @IsInt({ each: true })
  @Min(5, {
    each: true,
    message: 'reminder offsets must be at least 5 minutes',
  })
  @Max(720, {
    each: true,
    message: 'reminder offsets must be at most 720 minutes (12 hours)',
  })
  reminderOffsetsMin?: number[] = [];

  @ApiPropertyOptional({
    description: 'Whether the night prayer schedule is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
