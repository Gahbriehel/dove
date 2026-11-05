import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class MemberLoginDto {
  @ApiProperty({
    description: 'Email address or phone number',
    example: 'sarah.adeyemi@example.com',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email or phone number is required' })
  identifier: string;

  @ApiProperty({
    description: '4-digit numeric login PIN',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;

  @ApiPropertyOptional({
    description: 'Church slug (defaults to primary church if omitted)',
    example: 'abwog',
  })
  @IsString()
  @IsOptional()
  churchSlug?: string;
}
