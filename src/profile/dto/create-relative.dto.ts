import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, RelationshipType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateRelativeDto {
  @ApiProperty({ description: 'First name', example: 'Tunde' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Adeyemi' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    enum: RelationshipType,
    description: 'What the new person is to the member',
    example: RelationshipType.SPOUSE,
  })
  @IsEnum(RelationshipType)
  relationship: RelationshipType;

  @ApiPropertyOptional({
    description: 'Free text for OTHER relationship type',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  relationshipNote?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'tunde@example.com',
  })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '08034567890',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: Gender, description: 'Gender' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-04-02',
  })
  @IsString()
  @IsOptional()
  dateOfBirth?: string;
}
