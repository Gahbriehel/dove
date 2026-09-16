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

  @ApiPropertyOptional({
    description: 'Present on email.failed events (SMTP-level rejection)',
  })
  @IsObject()
  @IsOptional()
  failed?: {
    reason?: string;
  };

  @ApiPropertyOptional({
    description:
      'Present on email.suppressed events (recipient on suppression list)',
  })
  @IsObject()
  @IsOptional()
  suppressed?: {
    type?: string;
    message?: string;
  };

  @ApiPropertyOptional({
    description:
      'Email tags as returned by Resend webhooks: a flat key/value map, not the array shape used when sending',
  })
  @IsObject()
  @IsOptional()
  tags?: Record<string, string>;
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
