import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, MembershipStatus } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'First name',
    maxLength: 100,
    example: 'John',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    maxLength: 100,
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    maxLength: 255,
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    maxLength: 50,
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Gender' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1995-06-15',
  })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Residential address',
    example: '123 Grace Street',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    enum: MembershipStatus,
    description: 'Self-selected membership status in the church',
    example: MembershipStatus.MEMBER,
  })
  @IsEnum(MembershipStatus)
  @IsOptional()
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Array of department IDs the person belongs to or serves in',
    type: [String],
    example: ['d3b07384-d113-4a44-9c86-1d113f8c8501'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  departmentIds?: string[];
}
