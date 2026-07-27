import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInDto } from './dto/check-in.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(checkInDto: CheckInDto, adminUserId?: string) {
    const { token } = checkInDto;

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
            membershipStatus: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
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

    if (!registration) {
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
}
