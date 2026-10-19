import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClaimProfileDto {
  @ApiPropertyOptional({
    description: 'Email address associated with your profile',
    example: 'member@example.com',
  })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number associated with your profile',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Church slug (optional, defaults to primary church)',
    example: 'abwog',
  })
  @IsString()
  @IsOptional()
  churchSlug?: string;
}
