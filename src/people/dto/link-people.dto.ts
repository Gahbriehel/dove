import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RelationshipType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class LinkPeopleDto {
  @ApiProperty({ description: 'ID of the person to link to', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  relatedPersonId: string;

  @ApiProperty({
    enum: RelationshipType,
    description: 'What relatedPerson is to person',
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
}
