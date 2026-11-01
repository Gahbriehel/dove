import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TEMPLATE_BODY_MAX_LENGTH } from '../template-renderer';

export class PreviewMessageTemplateDto {
  @ApiProperty({
    description: 'Template text to render with sample values',
    maxLength: TEMPLATE_BODY_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(TEMPLATE_BODY_MAX_LENGTH)
  body: string;
}
