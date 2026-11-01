import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ConfirmOutreachDto {
  @ApiProperty({
    description: 'true if the admin sent the message, false if they did not',
  })
  @IsBoolean()
  sent: boolean;
}
