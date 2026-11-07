import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class EncouragementSlotDto {
  @ApiProperty({
    description: 'Day of the week (0 = Sunday .. 6 = Saturday)',
    minimum: 0,
    maximum: 6,
    example: 2,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  day: number;

  @ApiProperty({
    description: 'Time of day in HH:mm format (Africa/Lagos timezone)',
    example: '12:30',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:mm format (00:00 to 23:59)',
  })
  time: string;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    description:
      'Wall-clock time to send scripture notifications on startsOn date (Africa/Lagos)',
    example: '07:00',
    default: '07:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scriptureSendTime must be in HH:mm format (00:00 to 23:59)',
  })
  scriptureSendTime?: string;

  @ApiPropertyOptional({
    description:
      'Scheduled weekday and time slots for encouragement pushes (max 14 slots)',
    type: [EncouragementSlotDto],
    example: [{ day: 2, time: '12:30' }],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14, {
    message: 'At most 14 encouragement slots may be configured',
  })
  @ValidateNested({ each: true })
  @Type(() => EncouragementSlotDto)
  encouragementSlots?: EncouragementSlotDto[];
}
