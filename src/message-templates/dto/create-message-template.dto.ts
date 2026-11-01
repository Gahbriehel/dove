import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInReason, MessageChannel, OutreachPurpose } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TEMPLATE_BODY_MAX_LENGTH } from '../template-renderer';

export class CreateMessageTemplateDto {
  @ApiPropertyOptional({
    enum: MessageChannel,
    default: MessageChannel.WHATSAPP,
  })
  @IsEnum(MessageChannel)
  @IsOptional()
  channel?: MessageChannel;

  @ApiProperty({ enum: OutreachPurpose })
  @IsEnum(OutreachPurpose)
  purpose: OutreachPurpose;

  @ApiPropertyOptional({
    enum: CheckInReason,
    description:
      'Only for PASTORAL_CHECK_IN templates. Leave empty for a template that suits any reason.',
  })
  @IsEnum(CheckInReason)
  @IsOptional()
  checkInReason?: CheckInReason | null;

  @ApiProperty({ example: 'Missed you', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description:
      'Message text. Allowed placeholders: {{firstName}}, {{adminName}}, {{churchName}}.',
    example: "Hi {{firstName}}, it's {{adminName}} from {{churchName}}.",
    maxLength: TEMPLATE_BODY_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEMPLATE_BODY_MAX_LENGTH)
  body: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
