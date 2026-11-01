import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OUTREACH_BODY_MAX_LENGTH } from '../outreach.constants';
import { PreviewOutreachDto } from './preview-outreach.dto';

export class CreateOutreachDto extends PreviewOutreachDto {
  @ApiProperty({
    description: 'Final message text, stored exactly as sent',
    minLength: 1,
    maxLength: OUTREACH_BODY_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(OUTREACH_BODY_MAX_LENGTH)
  body: string;
}
