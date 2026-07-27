import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, MembershipStatus } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePersonDto {
  @ApiPropertyOptional({
    description:
      'ID of the church this person belongs to (optional, inferred automatically if omitted)',
  })
  @IsUUID()
  @IsOptional()
  churchId?: string;

  @ApiProperty({ description: 'First name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ description: 'Last name', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({ description: 'Email address', maxLength: 255 })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Gender of the person' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    enum: MembershipStatus,
    default: MembershipStatus.VISITOR,
    description: 'Membership status in the church',
  })
  @IsEnum(MembershipStatus)
  @IsOptional()
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({ description: 'Date of birth (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'Residential address' })
  @IsString()
  @IsOptional()
  address?: string;
}
