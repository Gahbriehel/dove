import { ApiPropertyOptional } from '@nestjs/swagger';
import { GivingPurpose } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class QueryGivingAccountDto {
  @ApiPropertyOptional({
    description: 'Filter accounts that serve this purpose',
    enum: GivingPurpose,
  })
  @IsOptional()
  @IsEnum(GivingPurpose, {
    message:
      'purpose must be a valid GivingPurpose (TITHE, OFFERING, BUILDING, MISSIONS, SEED, SPECIAL)',
  })
  purpose?: GivingPurpose;

  @ApiPropertyOptional({
    description: 'Optional church ID to query accounts for',
  })
  @IsOptional()
  @IsString()
  churchId?: string;
}
