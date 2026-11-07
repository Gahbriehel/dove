import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEncouragementDto {
  @ApiProperty({
    description: 'Encouragement message text (1-240 chars)',
    maxLength: 240,
    example: 'The Lord is your shepherd; you shall not want.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(240)
  text: string;

  @ApiPropertyOptional({
    description: 'Optional scripture reference (max 100 chars)',
    maxLength: 100,
    example: 'Psalm 23:1',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string | null;

  @ApiPropertyOptional({
    description: 'Whether this encouragement message is active for sending',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

export class UpdateEncouragementDto {
  @ApiPropertyOptional({
    description: 'Encouragement message text (1-240 chars)',
    maxLength: 240,
    example: 'The Lord is your shepherd; you shall not want.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  text?: string;

  @ApiPropertyOptional({
    description: 'Optional scripture reference (max 100 chars)',
    maxLength: 100,
    example: 'Psalm 23:1',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string | null;

  @ApiPropertyOptional({
    description: 'Whether this encouragement message is active for sending',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
