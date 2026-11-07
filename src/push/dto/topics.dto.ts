import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ALLOWED_TOPICS, PushTopic } from './subscribe.dto';

export class UpdateTopicsDto {
  @ApiProperty({
    description: 'Push service endpoint URL',
    maxLength: 1024,
    example: 'https://fcm.googleapis.com/fcm/send/...',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Matches(/^https:\/\//, {
    message: 'Endpoint must be a valid https URL',
  })
  endpoint: string;

  @ApiProperty({
    description: 'Updated topics array',
    example: ['night-prayer', 'confessions'],
    enum: ALLOWED_TOPICS,
    isArray: true,
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLOWED_TOPICS, { each: true })
  topics: PushTopic[];
}
