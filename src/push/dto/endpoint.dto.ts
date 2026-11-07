import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class EndpointDto {
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
}
