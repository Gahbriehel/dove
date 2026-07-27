import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ description: 'ID of the event this team belongs to' })
  @IsUUID()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    description: 'Team name (e.g. Red Team, Blue Team)',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Team color identifier or hex code',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  color?: string;
}
