import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AddDepartmentMemberDto {
  @ApiProperty({
    description: 'ID of the person to add to the department',
    example: 'd3b07384-d113-4a44-9c86-1d113f8c8501',
  })
  @IsUUID()
  @IsNotEmpty()
  personId: string;

  @ApiPropertyOptional({
    description: 'Role within the department',
    example: 'Lead',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  role?: string;
}
