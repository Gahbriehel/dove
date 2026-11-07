import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { IsDateOnly } from '../../scriptures/utils/scripture.util';

@ValidatorConstraint({ name: 'isNotBeforeStartsOn', async: false })
export class IsNotBeforeStartsOnConstraint implements ValidatorConstraintInterface {
  validate(endsOn: unknown, args: ValidationArguments) {
    const obj = args.object as ConfessionReminderItemDto;
    if (typeof endsOn !== 'string' || typeof obj.startsOn !== 'string')
      return true;
    return endsOn >= obj.startsOn;
  }

  defaultMessage() {
    return 'endsOn must not be before startsOn';
  }
}

@ValidatorConstraint({ name: 'isUniqueArray', async: false })
export class IsUniqueArrayConstraint implements ValidatorConstraintInterface {
  validate(arr: unknown) {
    if (!Array.isArray(arr)) return true;
    return new Set(arr).size === arr.length;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must not contain duplicate values`;
  }
}

export class ConfessionReminderItemDto {
  @ApiProperty({
    description: 'Time of day in HH:mm format (Africa/Lagos)',
    example: '06:30',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'timeOfDay must be in HH:mm format (00:00 to 23:59)',
  })
  timeOfDay: string;

  @ApiPropertyOptional({
    description:
      'Days of the week (0 = Sunday .. 6 = Saturday); empty = every day',
    example: [0, 1, 2, 3, 4, 5, 6],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @Validate(IsUniqueArrayConstraint)
  daysOfWeek?: number[] = [];

  @ApiPropertyOptional({
    description: 'Start date in YYYY-MM-DD format (null = no start limit)',
    example: '2026-11-01',
    nullable: true,
  })
  @IsOptional()
  @IsDateOnly()
  startsOn?: string | null;

  @ApiPropertyOptional({
    description: 'End date in YYYY-MM-DD format (null = no end limit)',
    example: '2026-11-30',
    nullable: true,
  })
  @IsOptional()
  @IsDateOnly()
  @Validate(IsNotBeforeStartsOnConstraint)
  endsOn?: string | null;

  @ApiPropertyOptional({
    description: 'Optional custom push body (max 200 chars)',
    maxLength: 200,
    example: 'Remember to declare your confessions today!',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string | null;
}

export class UpdateConfessionRemindersDto {
  @ApiProperty({
    description: 'List of reminders for this confession (max 6)',
    type: [ConfessionReminderItemDto],
  })
  @IsArray()
  @ArrayMaxSize(6, { message: 'A confession may have at most 6 reminders' })
  @ValidateNested({ each: true })
  @Type(() => ConfessionReminderItemDto)
  reminders: ConfessionReminderItemDto[];
}
