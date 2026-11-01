import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OutreachPurpose } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class PreviewOutreachDto {
  @ApiProperty({ description: 'Person to message' })
  @IsUUID()
  personId: string;

  @ApiProperty({ enum: OutreachPurpose })
  @IsEnum(OutreachPurpose)
  purpose: OutreachPurpose;

  @ApiPropertyOptional({
    description: 'Pastoral check-in this message relates to',
  })
  @IsUUID()
  @IsOptional()
  checkInId?: string;

  @ApiPropertyOptional({
    description:
      'Force a specific template. When omitted one is chosen and rotated automatically.',
  })
  @IsUUID()
  @IsOptional()
  templateId?: string;
}
