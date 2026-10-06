import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CSV_EXPORT_MAX_ROWS } from '../common/utils/csv.util';
import { CheckInDto } from './dto/check-in.dto';
import { QueryAttendanceDto } from './dto/query-attendance.dto';

const ATTENDANCE_INCLUDE = {
  registration: {
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          membershipStatus: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
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
  },
} satisfies Prisma.AttendanceInclude;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(
    checkInDto: CheckInDto,
    adminUserId?: string,
    userChurchId?: string,
  ) {
    const { token } = checkInDto;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    // 1. Find registration by token
    const registration = await this.prisma.registration.findUnique({
      where: { token },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            gender: true,
            membershipStatus: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            churchId: true,
            startDate: true,
            endDate: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        attendance: true,
      },
    });

    if (!registration || registration.event.churchId !== churchId) {
      throw new NotFoundException('Invalid registration token');
    }

    // 2. Ensure attendee has not checked in already
    if (registration.attendance) {
      throw new BadRequestException({
        message: 'Attendee has already checked in',
        attendance: registration.attendance,
        person: registration.person,
        team: registration.team,
        event: registration.event,
      });
    }

    // 3. Create attendance record and update registration status
    const [attendance] = await this.prisma.$transaction([
      this.prisma.attendance.create({
        data: {
          registrationId: registration.id,
          checkedInBy: adminUserId || null,
        },
      }),
      this.prisma.registration.update({
        where: { id: registration.id },
        data: { status: RegistrationStatus.CHECKED_IN },
      }),
    ]);

    return {
      message: 'Check-in successful',
      attendance,
      person: registration.person,
      team: registration.team,
      event: registration.event,
      registrationNumber: registration.registrationNumber,
      status: RegistrationStatus.CHECKED_IN,
    };
  }

  private buildWhere(
    query: QueryAttendanceDto,
    churchId: string,
  ): Prisma.AttendanceWhereInput {
    const { eventId, search } = query;

    const registrationWhere: Prisma.RegistrationWhereInput = {
      event: {
        churchId,
      },
    };

    if (eventId) {
      registrationWhere.eventId = eventId;
    }

    if (search) {
      registrationWhere.OR = [
        { registrationNumber: { contains: search } },
        { person: { firstName: { contains: search } } },
        { person: { lastName: { contains: search } } },
        { person: { email: { contains: search } } },
        { person: { phone: { contains: search } } },
      ];
    }

    return {
      registration: registrationWhere,
    };
  }

  async findAll(query: QueryAttendanceDto, userChurchId?: string) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, churchId);

    const [items, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        skip,
        take: limit,
        orderBy: { checkedInAt: 'desc' },
        include: ATTENDANCE_INCLUDE,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportAll(query: QueryAttendanceDto, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const where = this.buildWhere(query, churchId);

    return this.prisma.attendance.findMany({
      where,
      take: CSV_EXPORT_MAX_ROWS,
      orderBy: { checkedInAt: 'desc' },
      include: ATTENDANCE_INCLUDE,
    });
  }

  async undoCheckIn(id: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id,
        registration: {
          event: {
            churchId,
          },
        },
      },
      include: {
        registration: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException(
        `Attendance record with ID "${id}" not found`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.attendance.delete({
        where: { id: attendance.id },
      }),
      this.prisma.registration.update({
        where: { id: attendance.registrationId },
        data: { status: RegistrationStatus.CONFIRMED },
      }),
    ]);

    return {
      message: 'Check-in undone successfully',
      attendanceId: id,
      registrationId: attendance.registrationId,
    };
  }
}
