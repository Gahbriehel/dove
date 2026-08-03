import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateScoreDto {
  @ApiPropertyOptional({
    description: 'ID of the game (if moving score to another game)',
  })
  @IsUUID()
  @IsOptional()
  gameId?: string;

  @ApiPropertyOptional({
    description: 'ID of the team (if reassigning score to another team)',
  })
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Points awarded', example: 50 })
  @IsInt()
  @Min(0)
  @IsOptional()
  points?: number;

  @ApiPropertyOptional({ description: 'Optional notes regarding the score' })
  @IsString()
  @IsOptional()
  notes?: string;
}
