import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class QueryPersonDto {
  @ApiPropertyOptional({ description: 'Filter by church ID' })
  @IsUUID()
  @IsOptional()
  churchId?: string;

  @ApiPropertyOptional({
    enum: MembershipStatus,
    description: 'Filter by membership status',
  })
  @IsEnum(MembershipStatus)
  @IsOptional()
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Search by first name, last name, email, or phone',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;
}
