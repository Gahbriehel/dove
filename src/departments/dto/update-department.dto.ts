import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateDepartmentDto } from './create-department.dto';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {
  @ApiPropertyOptional({
    description: 'Name of the department',
    maxLength: 100,
    example: 'Choir & Praise',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Description of the department' })
  @IsString()
  @IsOptional()
  description?: string;
}
