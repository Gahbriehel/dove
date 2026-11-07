import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const ALLOWED_TOPICS = [
  'night-prayer',
  'confessions',
  'scriptures',
  'encouragement',
] as const;

export type PushTopic = (typeof ALLOWED_TOPICS)[number];

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'P256DH public key' })
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @ApiProperty({ description: 'Auth secret' })
  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class PushSubscriptionDetailDto {
  @ApiProperty({
    description: 'Push service endpoint URL (must start with https://)',
    maxLength: 1024,
    example: 'https://fcm.googleapis.com/fcm/send/...',
  })
  @IsString()
  @MaxLength(1024)
  @Matches(/^https:\/\//, {
    message: 'Endpoint must be a valid https URL',
  })
  endpoint: string;

  @ApiProperty({
    description: 'Subscription keys',
    type: PushSubscriptionKeysDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class SubscribeDto {
  @ApiProperty({
    description: 'Browser Web Push subscription object',
    type: PushSubscriptionDetailDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionDetailDto)
  subscription: PushSubscriptionDetailDto;

  @ApiPropertyOptional({
    description: 'Subscribed topics (subset of the four topics)',
    example: ['night-prayer', 'confessions', 'scriptures', 'encouragement'],
    enum: ALLOWED_TOPICS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(ALLOWED_TOPICS, { each: true })
  topics?: PushTopic[] = [...ALLOWED_TOPICS];

  @ApiPropertyOptional({
    description: 'Optional member authentication token for signed-in members',
  })
  @IsOptional()
  @IsString()
  memberToken?: string;
}
