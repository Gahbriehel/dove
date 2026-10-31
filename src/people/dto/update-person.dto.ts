import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePersonDto } from './create-person.dto';

export class UpdatePersonDto extends PartialType(CreatePersonDto) {
  @ApiPropertyOptional({
    description:
      'Set to false to re-subscribe a person who unsubscribed from broadcast emails, or true to opt them out manually. emailOptOutAt is maintained automatically.',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  emailOptOut?: boolean;
}
