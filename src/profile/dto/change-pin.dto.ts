import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ChangePinDto {
  @ApiPropertyOptional({
    description:
      'Current 4-digit PIN. Required only when a PIN is already set on the profile.',
    example: '2491',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Current PIN must be exactly 4 digits' })
  currentPin?: string;

  @ApiProperty({
    description: 'New 4-digit numeric login PIN',
    example: '8137',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'New PIN must be exactly 4 digits' })
  newPin: string;
}
