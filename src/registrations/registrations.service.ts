import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(RegistrationsService.name);

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

    // Wrap person lookup/creation, registration duplication check, team assignment, and registration creation in a transaction
    const { registration, assignedTeam, qrCodeDataUrl, recipientPerson } =
      await this.prisma.$transaction(async (tx) => {
        // 1. Find or create Person without updating existing person details
        let personByEmail = null;
        let personByPhone = null;

        if (email) {
          personByEmail = await tx.person.findFirst({
            where: { churchId, email },
          });
        }

        if (phone) {
          personByPhone = await tx.person.findFirst({
            where: { churchId, phone },
          });
        }

        if (
          personByEmail &&
          personByPhone &&
          personByEmail.id !== personByPhone.id
        ) {
          throw new ConflictException(
            'The provided email and phone number belong to different registered attendees.',
          );
        }

        let person = personByEmail || personByPhone;

        if (!person) {
          person = await tx.person.create({
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
        const existingRegistration = await tx.registration.findUnique({
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
          const qrCodeUrl = await QRCode.toDataURL(existingRegistration.token);
          throw new ConflictException({
            message: 'Attendee has already registered for this event',
            registration: {
              ...existingRegistration,
              qrCodeDataUrl: qrCodeUrl,
            },
          });
        }

        // 3. Balanced Team Assignment
        const teams = await tx.team.findMany({
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

        teams.sort((a, b) => {
          if (a._count.registrations !== b._count.registrations) {
            return a._count.registrations - b._count.registrations;
          }
          return a.createdAt.getTime() - b.createdAt.getTime();
        });

        const selectedTeam = teams[0];

        // 4. Generate tokens & registration number (format: reg[initials][identifier], max 8 chars)
        const registrationNumber = await this.generateRegistrationNumber(
          event.title,
          tx,
        );
        const token = crypto.randomUUID();
        const qrCodeUrl = await QRCode.toDataURL(token);

        // 5. Save registration
        const createdReg = await tx.registration.create({
          data: {
            eventId,
            personId: person.id,
            teamId: selectedTeam.id,
            registrationNumber,
            token,
            status: RegistrationStatus.CONFIRMED,
          },
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                location: true,
              },
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

        return {
          registration: createdReg,
          assignedTeam: selectedTeam,
          qrCodeDataUrl: qrCodeUrl,
          recipientPerson: person,
        };
      });

    // Asynchronously send confirmation email if recipient email is available
    if (recipientPerson.email) {
      const formattedDate = event.startDate
        ? new Date(event.startDate).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })
        : undefined;

      this.emailService
        .sendRegistrationConfirmation({
          recipientEmail: recipientPerson.email,
          recipientName: `${recipientPerson.firstName} ${recipientPerson.lastName}`,
          eventTitle: event.title,
          eventDate: formattedDate,
          eventLocation: event.location || undefined,
          contactEmail: event.church.email || undefined,
          contactPhone: event.church.phone || undefined,
          registrationNumber: registration.registrationNumber,
          qrToken: registration.token,
          qrCodeDataUrl,
          teamName: assignedTeam.name,
          teamColor: assignedTeam.color || undefined,
        })
        .catch((err) => {
          this.logger.error(
            `Failed to send registration confirmation email to ${recipientPerson.email}`,
            err instanceof Error ? err.stack : String(err),
          );
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

  async findAll(query: QueryRegistrationDto, userChurchId?: string) {
    const { eventId, teamId, status, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where: Prisma.RegistrationWhereInput = {
      event: {
        churchId,
      },
    };

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

  async findOne(id: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const registration = await this.prisma.registration.findFirst({
      where: {
        id,
        event: {
          churchId,
        },
      },
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

  async remove(id: string, userChurchId?: string) {
    const registration = await this.findOne(id, userChurchId);

    await this.prisma.registration.delete({
      where: { id: registration.id },
    });

    return { message: `Registration with ID "${id}" deleted successfully` };
  }

  private async generateRegistrationNumber(
    eventTitle: string,
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = 'reg';
    const words = eventTitle
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    let initials = '';

    if (words.length >= 2) {
      initials = (words[0][0] + words[1][0])
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
    } else if (words.length === 1) {
      initials = words[0]
        .substring(0, 2)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
    }

    if (!initials) {
      initials = 'EV';
    }

    initials = initials.substring(0, 2);

    const identifierLength = Math.max(1, 8 - prefix.length - initials.length);

    let attempts = 0;
    while (attempts < 10) {
      const randomStr = crypto
        .randomBytes(3)
        .toString('hex')
        .toUpperCase()
        .substring(0, identifierLength);

      const candidate = `${prefix}${initials}${randomStr}`;

      const existing = await tx.registration.findUnique({
        where: { registrationNumber: candidate },
      });

      if (!existing) {
        return candidate;
      }
      attempts++;
    }

    const fallbackHex = crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()
      .substring(0, identifierLength);
    return `${prefix}${initials}${fallbackHex}`;
  }
}
