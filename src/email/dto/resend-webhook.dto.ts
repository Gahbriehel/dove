import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class ResendWebhookDataDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  email_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  to?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  bounce?: {
    type?: string;
    message?: string;
  };

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  tags?: Array<{ name: string; value: string }>;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  headers?: Array<{ name: string; value: string }>;
}

export class ResendWebhookPayloadDto {
  @ApiProperty({
    description: 'Event type (e.g. email.bounced, email.dropped)',
  })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  created_at?: string;

  @ApiProperty({ description: 'Webhook event data payload' })
  @IsObject()
  data: ResendWebhookDataDto;
}
