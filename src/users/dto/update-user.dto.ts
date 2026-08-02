import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-012-3456' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Set to false to deactivate the user',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'ADMIN',
    description:
      'System role (e.g. SUPER_ADMIN, ADMIN, WORKER, LEADER, MEMBER)',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    enum: MembershipStatus,
    example: MembershipStatus.MEMBER,
    description: 'Church membership status in the people directory',
  })
  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;
}
