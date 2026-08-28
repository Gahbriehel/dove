import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class RemediateEmailBounceDto {
  @ApiProperty({
    description: 'New, corrected email address for the user/person',
    example: 'user.corrected@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;

  @ApiPropertyOptional({
    description: 'Whether to trigger a resend of the email (default: false)',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  resendOriginal?: boolean;

  @ApiPropertyOptional({
    description: 'Optional subject line if resending original email',
    example: 'Registration Confirmation',
  })
  @IsString()
  @IsOptional()
  subject?: string;
}
