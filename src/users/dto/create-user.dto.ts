import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'admin@church.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description:
      'Role to assign: SUPER_ADMIN, ADMIN, COORDINATOR, LEADER, WORKER, MEMBER, or REGISTRATION_DESK',
    default: 'ADMIN',
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'SUPER_ADMIN',
    'ADMIN',
    'COORDINATOR',
    'LEADER',
    'WORKER',
    'MEMBER',
    'REGISTRATION_DESK',
  ])
  role?: string;
}
