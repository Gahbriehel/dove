import { Injectable } from '@nestjs/common';
import { EventStatus, Gender, MembershipStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardDataDto } from './dto/dashboard-response.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(userChurchId?: string): Promise<DashboardDataDto> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );

    const [
      totalRegistrations,
      totalCheckIns,
      totalCheckInsToday,
      totalVisitors,
      totalMembers,
      totalWorkers,
      totalLeaders,
      totalPeople,
      genderMale,
      genderFemale,
      genderOther,
      genderUnspecified,
      totalEvents,
      activeEvents,
      rawLatestRegistrations,
      rawUpcomingEvents,
    ] = await Promise.all([
      // Total registrations for church events
      this.prisma.registration.count({
        where: { event: { churchId } },
      }),

      // Total check-ins all time
      this.prisma.attendance.count({
        where: { registration: { event: { churchId } } },
      }),

      // Total check-ins today
      this.prisma.attendance.count({
        where: {
          registration: { event: { churchId } },
          checkedInAt: { gte: startOfDay, lte: endOfDay },
        },
      }),

      // People status counts
      this.prisma.person.count({
        where: { churchId, membershipStatus: MembershipStatus.VISITOR },
      }),
      this.prisma.person.count({
        where: { churchId, membershipStatus: MembershipStatus.MEMBER },
      }),
      this.prisma.person.count({
        where: { churchId, membershipStatus: MembershipStatus.WORKER },
      }),
      this.prisma.person.count({
        where: { churchId, membershipStatus: MembershipStatus.LEADER },
      }),
      this.prisma.person.count({
        where: { churchId },
      }),

      // Gender counts
      this.prisma.person.count({
        where: { churchId, gender: Gender.MALE },
      }),
      this.prisma.person.count({
        where: { churchId, gender: Gender.FEMALE },
      }),
      this.prisma.person.count({
        where: { churchId, gender: Gender.OTHER },
      }),
      this.prisma.person.count({
        where: { churchId, gender: null },
      }),

      // Event counts
      this.prisma.event.count({
        where: { churchId },
      }),
      this.prisma.event.count({
        where: { churchId, status: EventStatus.PUBLISHED },
      }),

      // Latest 5 registrations
      this.prisma.registration.findMany({
        where: { event: { churchId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              membershipStatus: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              startDate: true,
              location: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      }),

      // Upcoming 5 events
      this.prisma.event.findMany({
        where: {
          churchId,
          startDate: { gte: now },
        },
        orderBy: { startDate: 'asc' },
        take: 5,
        include: {
          _count: {
            select: {
              registrations: true,
              teams: true,
            },
          },
        },
      }),
    ]);

    const attendanceRate =
      totalRegistrations > 0
        ? Number(((totalCheckIns / totalRegistrations) * 100).toFixed(2))
        : 0;

    const upcomingEvents = rawUpcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      status: e.status,
      totalRegistrations: e._count.registrations,
      totalTeams: e._count.teams,
    }));

    return {
      overview: {
        totalRegistrations,
        totalCheckInsToday,
        totalVisitors,
        totalMembers,
        totalWorkers,
        totalLeaders,
        totalPeople,
        attendanceRate,
        totalEvents,
        activeEvents,
      },
      demographics: {
        membership: {
          visitors: totalVisitors,
          members: totalMembers,
          workers: totalWorkers,
          leaders: totalLeaders,
        },
        gender: {
          male: genderMale,
          female: genderFemale,
          other: genderOther,
          unspecified: genderUnspecified,
        },
      },
      latestRegistrations: rawLatestRegistrations,
      upcomingEvents,
    };
  }
}
