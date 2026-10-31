import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
} from 'class-validator';

export class SendBatchPeopleEmailDto {
  @ApiPropertyOptional({
    description: 'Specific array of person IDs to target (optional)',
    type: [String],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  personIds?: string[];

  @ApiPropertyOptional({
    enum: MembershipStatus,
    description:
      'Filter target recipients by membership status (VISITOR, MEMBER, WORKER, LEADER)',
  })
  @IsEnum(MembershipStatus)
  @IsOptional()
  membershipStatus?: MembershipStatus;

  @ApiPropertyOptional({
    description: 'Search filter string matching first/last name or email',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({
    description:
      'Email subject line (supports placeholders e.g. {{firstName}})',
    example: 'Church Update for {{firstName}}',
  })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({
    description: 'Optional header banner title',
    example: 'Weekly Announcement',
  })
  @IsString()
  @IsOptional()
  heading?: string;

  @ApiProperty({
    description:
      'Email message content. Accepts either plain text (double line breaks become paragraphs) or rich-text HTML (e.g. from a WYSIWYG editor like Quill) — HTML is sanitized to a safe subset of tags before sending. Supports placeholders.',
    example:
      '<p>Dear {{firstName}},</p><p>Here are our updates for this week.</p>',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button text',
    example: 'Read More',
  })
  @IsString()
  @IsOptional()
  ctaLabel?: string;

  @ApiPropertyOptional({
    description: 'Optional Call to Action button URL',
    example: 'https://example.org/news',
  })
  @IsUrl()
  @IsOptional()
  ctaUrl?: string;

  @ApiPropertyOptional({
    description:
      'Flyer or announcement image URL (e.g. uploaded via /uploads/image or external URL)',
    example: '/public/uploads/flyer.png',
  })
  @IsString()
  @IsOptional()
  imageUrl?: string;
}
