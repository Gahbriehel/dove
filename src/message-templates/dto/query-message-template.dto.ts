import { ApiPropertyOptional } from '@nestjs/swagger';
import { CheckInReason, MessageChannel, OutreachPurpose } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryMessageTemplateDto {
  @ApiPropertyOptional({ enum: MessageChannel })
  @IsEnum(MessageChannel)
  @IsOptional()
  channel?: MessageChannel;

  @ApiPropertyOptional({ enum: OutreachPurpose })
  @IsEnum(OutreachPurpose)
  @IsOptional()
  purpose?: OutreachPurpose;

  @ApiPropertyOptional({ enum: CheckInReason })
  @IsEnum(CheckInReason)
  @IsOptional()
  checkInReason?: CheckInReason;

  @ApiPropertyOptional({
    description: 'Include templates that have been switched off',
    default: false,
  })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}
