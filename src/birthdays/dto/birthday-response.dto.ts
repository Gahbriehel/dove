import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipStatus } from '@prisma/client';
import { BirthdayStatusFilter } from './query-birthday.dto';

export class BirthdayGreetingAuthorDto {
  @ApiProperty({ example: 'user-uuid' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Admin' })
  lastName: string;

  @ApiProperty({ example: 'admin@dove.church' })
  email: string;
}

export class BirthdayGreetingRecordDto {
  @ApiProperty({ example: 'greeting-uuid' })
  id: string;

  @ApiProperty({ example: 2026 })
  year: number;

  @ApiProperty({ example: 'Happy Birthday John!' })
  subject: string;

  @ApiPropertyOptional({ example: 'Celebrating You!' })
  heading?: string | null;

  @ApiProperty({ example: '<p>Happy Birthday!</p>' })
  message: string;

  @ApiPropertyOptional({ example: '/public/uploads/card.png' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'Visit Church' })
  ctaLabel?: string | null;

  @ApiPropertyOptional({ example: 'https://example.org' })
  ctaUrl?: string | null;

  @ApiProperty({ example: '2026-10-05T12:00:00.000Z' })
  sentAt: Date;

  @ApiProperty({ type: BirthdayGreetingAuthorDto })
  sentBy: BirthdayGreetingAuthorDto;
}

export class BirthdayPersonItemDto {
  @ApiProperty({ example: 'person-uuid' })
  id: string;

  @ApiProperty({ example: 'Jane' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  email: string | null;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone: string | null;

  @ApiProperty({ enum: MembershipStatus, example: MembershipStatus.MEMBER })
  membershipStatus: MembershipStatus;

  @ApiProperty({ example: '1995-10-15T00:00:00.000Z' })
  dateOfBirth: Date;

  @ApiProperty({ example: '2026-10-15T00:00:00.000Z' })
  birthdayDate: Date;

  @ApiProperty({ example: 10 })
  daysUntil: number;

  @ApiProperty({ example: 31 })
  turningAge: number;

  @ApiProperty({
    example: BirthdayStatusFilter.PENDING,
    enum: BirthdayStatusFilter,
  })
  status: BirthdayStatusFilter;

  @ApiProperty({ example: false })
  isGreeted: boolean;

  @ApiPropertyOptional({ type: BirthdayGreetingRecordDto })
  greeting?: BirthdayGreetingRecordDto | null;
}

export class BirthdayListResponseDto {
  @ApiProperty({ type: [BirthdayPersonItemDto] })
  data: BirthdayPersonItemDto[];

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 2 })
  totalPages: number;
}
