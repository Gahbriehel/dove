import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EmailRecipientDto {
  @ApiPropertyOptional({ example: 'uuid-1234' })
  id?: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email!: string;

  @ApiProperty({
    example: 'PERSON',
    enum: ['PERSON', 'USER', 'REGISTRANT', 'UNKNOWN'],
  })
  type!: string;
}

export class EmailEventContextDto {
  @ApiProperty({ example: 'uuid-5678' })
  id!: string;

  @ApiProperty({ example: 'Annual Church Conference' })
  title!: string;

  @ApiPropertyOptional({ example: 'REG-2026-0001' })
  registrationNumber?: string;
}

export class EmailContentSummaryDto {
  @ApiPropertyOptional({ example: 'Special Announcement' })
  heading?: string;

  @ApiPropertyOptional({
    example: 'We look forward to seeing you at our upcoming service!',
  })
  message?: string;

  @ApiPropertyOptional({ example: 'View Event' })
  ctaLabel?: string;

  @ApiPropertyOptional({ example: 'https://example.com/events' })
  ctaUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/banner.png' })
  imageUrl?: string;
}

export class EmailSenderDto {
  @ApiProperty({ example: 'uuid-admin-123' })
  id!: string;

  @ApiProperty({ example: 'Admin User' })
  name!: string;

  @ApiProperty({ example: 'admin@church.org' })
  email!: string;
}

export class EmailLogItemDto {
  @ApiProperty({ example: 'uuid-log-123' })
  id!: string;

  @ApiProperty({ example: 'resend_email_456' })
  resendEmailId!: string;

  @ApiProperty({
    example: 'CUSTOM_BROADCAST',
    enum: [
      'CUSTOM_BROADCAST',
      'REGISTRATION_CONFIRMATION',
      'ADMIN_WELCOME',
      'BIRTHDAY_GREETING',
    ],
  })
  emailType!: string;

  @ApiProperty({ example: 'Sunday Service Update' })
  subject!: string;

  @ApiProperty({ type: EmailRecipientDto })
  recipient!: EmailRecipientDto;

  @ApiPropertyOptional({ type: EmailSenderDto })
  sentBy?: EmailSenderDto | null;

  @ApiPropertyOptional({ type: EmailEventContextDto })
  event?: EmailEventContextDto;

  @ApiPropertyOptional({ type: EmailContentSummaryDto })
  content?: EmailContentSummaryDto;

  @ApiProperty({
    example: 'DELIVERABLE',
    enum: ['DELIVERABLE', 'BOUNCED', 'DROPPED', 'COMPLAINED'],
  })
  deliveryStatus!: string;

  @ApiPropertyOptional({ example: 'Mailbox not found' })
  bounceReason?: string;

  @ApiProperty({ example: '2026-10-09T12:00:00.000Z' })
  sentAt!: Date;
}

export class EmailLogListResponseDto {
  @ApiProperty({ type: [EmailLogItemDto] })
  data!: EmailLogItemDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
