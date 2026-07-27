import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MembershipStatus, Prisma, RegistrationStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { QueryRegistrationDto } from './dto/query-registration.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE)
    private readonly emailService: IEmailService,
  ) {}

  async register(eventId: string, registerDto: RegisterDto) {
    const { firstName, lastName, email, phone, gender, dateOfBirth, address } =
      registerDto;

    if (!email && !phone) {
      throw new BadRequestException('Either email or phone must be provided');
    }

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { church: true },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    const churchId = event.churchId;

    // 1. Find existing Person by email or phone
    let person = null;
    if (email) {
      person = await this.prisma.person.findFirst({
        where: { churchId, email },
      });
    }

    if (!person && phone) {
      person = await this.prisma.person.findFirst({
        where: { churchId, phone },
      });
    }

    // If none exists, create Person
    if (!person) {
      person = await this.prisma.person.create({
        data: {
          churchId,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          gender: gender || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          address: address || null,
          membershipStatus: MembershipStatus.VISITOR,
        },
      });
    }

    // 2. Check if already registered for this event
    const existingRegistration = await this.prisma.registration.findUnique({
      where: {
        eventId_personId: {
          eventId,
          personId: person.id,
        },
      },
      include: {
        event: { select: { id: true, title: true, startDate: true } },
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        team: { select: { id: true, name: true, color: true } },
        attendance: true,
      },
    });

    if (existingRegistration) {
      const qrCodeDataUrl = await QRCode.toDataURL(existingRegistration.token);
      throw new ConflictException({
        message: 'Attendee has already registered for this event',
        registration: {
          ...existingRegistration,
          qrCodeDataUrl,
        },
      });
    }

    // 3. Balanced Team Assignment
    const teams = await this.prisma.team.findMany({
      where: { eventId },
      include: {
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!teams || teams.length === 0) {
      throw new UnprocessableEntityException(
        'Teams have not been configured for this event. Event setup is required before accepting registrations.',
      );
    }

    // Sort by fewest registrations, then by creation date / id for determinism
    teams.sort((a, b) => {
      if (a._count.registrations !== b._count.registrations) {
        return a._count.registrations - b._count.registrations;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const assignedTeam = teams[0];

    // 4. Generate registration number and secure token
    const timestampStr = Date.now().toString(36).toUpperCase();
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    const registrationNumber = `REG-${timestampStr}-${randomHex}`;
    const token = crypto.randomUUID();

    // 5. Generate QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(token);

    // 6. Save registration
    const registration = await this.prisma.registration.create({
      data: {
        eventId,
        personId: person.id,
        teamId: assignedTeam.id,
        registrationNumber,
        token,
        status: RegistrationStatus.CONFIRMED,
      },
      include: {
        event: {
          select: { id: true, title: true, startDate: true, location: true },
        },
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        team: { select: { id: true, name: true, color: true } },
      },
    });

    // 7. Asynchronously trigger confirmation email (if email exists)
    if (person.email) {
      this.emailService
        .sendRegistrationConfirmation({
          recipientEmail: person.email,
          recipientName: `${person.firstName} ${person.lastName}`,
          eventTitle: event.title,
          registrationNumber: registration.registrationNumber,
          qrToken: registration.token,
          qrCodeDataUrl,
          teamName: assignedTeam.name,
          teamColor: assignedTeam.color || undefined,
        })
        .catch((err) => {
          // Log email dispatch error without blocking response
          console.error('Failed to send confirmation email:', err);
        });
    }

    return {
      message: 'Registration successful',
      registration: {
        ...registration,
        qrCodeDataUrl,
      },
    };
  }

  async findAll(query: QueryRegistrationDto) {
    const { eventId, teamId, status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.RegistrationWhereInput = {};

    if (eventId) {
      where.eventId = eventId;
    }

    if (teamId) {
      where.teamId = teamId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { registrationNumber: { contains: search } },
        { person: { firstName: { contains: search } } },
        { person: { lastName: { contains: search } } },
        { person: { email: { contains: search } } },
        { person: { phone: { contains: search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.registration.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          event: { select: { id: true, title: true } },
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          team: { select: { id: true, name: true, color: true } },
          attendance: true,
        },
      }),
      this.prisma.registration.count({ where }),
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

  async findOne(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: {
        event: true,
        person: true,
        team: true,
        attendance: true,
      },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID "${id}" not found`);
    }

    const qrCodeDataUrl = await QRCode.toDataURL(registration.token);

    return {
      ...registration,
      qrCodeDataUrl,
    };
  }
}
