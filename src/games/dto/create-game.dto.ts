import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGameDto {
  @ApiProperty({ description: 'ID of the event this game belongs to' })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    description: 'Game name (e.g. Tug of War, Obstacle Course)',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ description: 'Rules or description of the game' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Maximum achievable score/points in this game',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  maxScore?: number;
}
