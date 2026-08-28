import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EventStatus,
  MembershipStatus,
  RegistrationStatus,
} from '@prisma/client';

export class DashboardOverviewDto {
  @ApiProperty({
    description: 'Total registrations across all church events',
    example: 150,
  })
  totalRegistrations: number;

  @ApiProperty({ description: 'Total check-ins performed today', example: 45 })
  totalCheckInsToday: number;

  @ApiProperty({ description: 'Total visitors / first timers', example: 30 })
  totalVisitors: number;

  @ApiProperty({ description: 'Total official members', example: 120 })
  totalMembers: number;

  @ApiProperty({ description: 'Total workers', example: 15 })
  totalWorkers: number;

  @ApiProperty({ description: 'Total leaders', example: 5 })
  totalLeaders: number;

  @ApiProperty({
    description: 'Total people in church directory',
    example: 170,
  })
  totalPeople: number;

  @ApiProperty({
    description: 'Overall attendance rate percentage (0 - 100)',
    example: 82.5,
  })
  attendanceRate: number;

  @ApiProperty({ description: 'Total events created', example: 12 })
  totalEvents: number;

  @ApiProperty({ description: 'Total active/published events', example: 3 })
  activeEvents: number;

  @ApiPropertyOptional({
    description: 'Total unresolved email delivery bounce alerts',
    example: 2,
  })
  unresolvedBounceCount?: number;
}

export class MembershipBreakdownDto {
  @ApiProperty({ example: 30 })
  visitors: number;

  @ApiProperty({ example: 120 })
  members: number;

  @ApiProperty({ example: 15 })
  workers: number;

  @ApiProperty({ example: 5 })
  leaders: number;
}

export class GenderBreakdownDto {
  @ApiProperty({ example: 80 })
  male: number;

  @ApiProperty({ example: 85 })
  female: number;

  @ApiProperty({ example: 2 })
  other: number;

  @ApiProperty({ example: 3 })
  unspecified: number;
}

export class DemographicsDto {
  @ApiProperty({ type: MembershipBreakdownDto })
  membership: MembershipBreakdownDto;

  @ApiProperty({ type: GenderBreakdownDto })
  gender: GenderBreakdownDto;
}

export class DashboardPersonDto {
  @ApiProperty({ example: 'b5c68b92-7208-410a-8ab5-eef4d40212e1' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiPropertyOptional({ example: 'john.doe@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+1234567890' })
  phone?: string | null;

  @ApiProperty({ enum: MembershipStatus, example: MembershipStatus.VISITOR })
  membershipStatus: MembershipStatus;
}

export class DashboardEventSummaryDto {
  @ApiProperty({ example: 'e5c68b92-7208-410a-8ab5-eef4d40212e1' })
  id: string;

  @ApiProperty({ example: 'Sunday Youth Convention' })
  title: string;

  @ApiProperty({ example: '2026-08-15T10:00:00.000Z' })
  startDate: Date;

  @ApiPropertyOptional({ example: 'Main Auditorium' })
  location?: string | null;
}

export class DashboardTeamSummaryDto {
  @ApiProperty({ example: 't5c68b92-7208-410a-8ab5-eef4d40212e1' })
  id: string;

  @ApiProperty({ example: 'Red Eagles' })
  name: string;

  @ApiPropertyOptional({ example: '#FF0000' })
  color?: string | null;
}

export class LatestRegistrationDto {
  @ApiProperty({ example: 'r5c68b92-7208-410a-8ab5-eef4d40212e1' })
  id: string;

  @ApiProperty({ example: 'REG-2026-001' })
  registrationNumber: string;

  @ApiProperty({
    enum: RegistrationStatus,
    example: RegistrationStatus.CHECKED_IN,
  })
  status: RegistrationStatus;

  @ApiProperty({ example: '2026-07-31T12:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ type: DashboardPersonDto })
  person: DashboardPersonDto;

  @ApiProperty({ type: DashboardEventSummaryDto })
  event: DashboardEventSummaryDto;

  @ApiPropertyOptional({ type: DashboardTeamSummaryDto, nullable: true })
  team?: DashboardTeamSummaryDto | null;
}

export class UpcomingEventDto {
  @ApiProperty({ example: 'e5c68b92-7208-410a-8ab5-eef4d40212e1' })
  id: string;

  @ApiProperty({ example: 'Annual Summer Camp' })
  title: string;

  @ApiPropertyOptional({ example: 'Three-day retreat for youth' })
  description?: string | null;

  @ApiPropertyOptional({ example: 'Mountain View Resort' })
  location?: string | null;

  @ApiProperty({ example: '2026-08-10T09:00:00.000Z' })
  startDate: Date;

  @ApiProperty({ example: '2026-08-12T17:00:00.000Z' })
  endDate: Date;

  @ApiProperty({ enum: EventStatus, example: EventStatus.PUBLISHED })
  status: EventStatus;

  @ApiProperty({
    description: 'Total registrations count for this event',
    example: 85,
  })
  totalRegistrations: number;

  @ApiProperty({
    description: 'Total teams configured for this event',
    example: 4,
  })
  totalTeams: number;
}

export class DashboardDataDto {
  @ApiProperty({ type: DashboardOverviewDto })
  overview: DashboardOverviewDto;

  @ApiProperty({ type: DemographicsDto })
  demographics: DemographicsDto;

  @ApiProperty({ type: [LatestRegistrationDto] })
  latestRegistrations: LatestRegistrationDto[];

  @ApiProperty({ type: [UpcomingEventDto] })
  upcomingEvents: UpcomingEventDto[];

  @ApiPropertyOptional()
  recentBounceAlerts?: any[];
}
