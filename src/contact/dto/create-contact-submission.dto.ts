import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContactSubmissionDto {
  @ApiProperty({
    description:
      'Type of contact submission (prayer request or general inquiry)',
    enum: ['prayer', 'inquiry'],
    example: 'prayer',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['prayer', 'inquiry'], {
    message: 'type must be either "prayer" or "inquiry"',
  })
  type: string;

  @ApiProperty({
    description: 'Full name of the user',
    example: 'Jane Doe',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "User's email address",
    example: 'jane.doe@example.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: "User's phone number",
    example: '+234 802 3308 877',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'Specific category selection dependent on type',
    example: 'Healing & Health',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    description: 'The core text body of the request or message',
    example: "Please pray for my mother's recovery.",
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description:
      'Whether the prayer request should be kept private. Only applicable when type = "prayer".',
    default: false,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
