import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class RecordScoreDto {
  @ApiProperty({ description: 'ID of the game' })
  @IsUUID()
  @IsNotEmpty()
  gameId: string;

  @ApiProperty({ description: 'ID of the team' })
  @IsUUID()
  @IsNotEmpty()
  teamId: string;

  @ApiProperty({ description: 'Points awarded', example: 50 })
  @IsInt()
  @IsNotEmpty()
  points: number;

  @ApiPropertyOptional({ description: 'Optional notes regarding the score' })
  @IsString()
  @IsOptional()
  notes?: string;
}
