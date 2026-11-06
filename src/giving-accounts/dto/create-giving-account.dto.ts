import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GivingCurrency, GivingPurpose } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsGivingAccountNumber } from './is-account-number.validator';

export class CreateGivingAccountDto {
  @ApiProperty({
    description: 'What the account is for (e.g. "Tithes & Offerings")',
    maxLength: 100,
    example: 'Tithes & Offerings',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  label: string;

  @ApiProperty({
    description: 'Bank name',
    maxLength: 100,
    example: 'GTBank',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  bankName: string;

  @ApiProperty({
    description: 'Account name',
    maxLength: 255,
    example: 'Abiding Word Of Grace Missions',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  accountName: string;

  @ApiProperty({
    description:
      'Account number (digits only after stripping spaces and hyphens; 10 digits for NGN, 6-34 digits for other currencies)',
    example: '0123456789',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @IsGivingAccountNumber()
  accountNumber: string;

  @ApiPropertyOptional({
    description: 'Currency code',
    enum: GivingCurrency,
    default: GivingCurrency.NGN,
  })
  @IsOptional()
  @IsEnum(GivingCurrency)
  currency?: GivingCurrency;

  @ApiPropertyOptional({
    description: 'Optional note or narration instructions',
    maxLength: 500,
    nullable: true,
    example: 'Use your name and purpose as the narration',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string' && value.trim() === '') return null;
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiProperty({
    description: 'Purposes this account can receive (1-6 unique purposes)',
    enum: GivingPurpose,
    isArray: true,
    example: [GivingPurpose.TITHE, GivingPurpose.OFFERING],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'purposes must not be empty' })
  @ArrayMinSize(1, { message: 'purposes must contain at least 1 purpose' })
  @ArrayMaxSize(6, { message: 'purposes must contain at most 6 purposes' })
  @ArrayUnique({ message: 'purposes must not contain duplicate values' })
  @IsEnum(GivingPurpose, {
    each: true,
    message: 'each purpose must be a valid GivingPurpose',
  })
  purposes: GivingPurpose[];

  @ApiPropertyOptional({
    description: 'Sort order (integer >= 0). Defaults to end of list (max + 1)',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    description: 'Whether the account is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
