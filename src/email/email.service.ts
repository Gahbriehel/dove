import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailLogDeliveryStatusFilter,
  EmailLogTypeFilter,
  QueryEmailLogsDto,
} from './dto/query-email-logs.dto';
import {
  EmailLogItemDto,
  EmailLogListResponseDto,
} from './dto/email-log-response.dto';
import { SendBatchPeopleEmailDto } from './dto/send-batch-people-email.dto';
import { SendBatchRegistrantsEmailDto } from './dto/send-batch-registrants-email.dto';
import { SendPersonEmailDto } from './dto/send-person-email.dto';
import { SendRegistrantEmailDto } from './dto/send-registrant-email.dto';
import {
  BatchCustomEmailResult,
  CustomEmailData,
  EMAIL_SERVICE,
} from './interfaces/email-service.interface';
import type { IEmailService } from './interfaces/email-service.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
  ) {}

  async sendToPerson(
    dto: SendPersonEmailDto,
    userChurchId?: string,
    sentByUserId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, churchId },
      include: { church: true },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${dto.personId}" not found`);
    }

    if (!person.email || person.email.trim() === '') {
      throw new BadRequestException(
        `Person "${person.firstName} ${person.lastName}" does not have a valid email address.`,
      );
    }

    const vars: Record<string, string> = {
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      email: person.email,
      churchName: person.church?.name || '',
    };

    const resolvedImageUrl = this.resolveImageUrl(dto.imageUrl);

    const emailData: CustomEmailData = {
      recipientEmail: person.email,
      recipientName: `${person.firstName} ${person.lastName}`,
      subject: this.replacePlaceholders(dto.subject, vars),
      heading: dto.heading
        ? this.replacePlaceholders(dto.heading, vars)
        : undefined,
      message: this.replacePlaceholders(dto.message, vars),
      ctaLabel: dto.ctaLabel
        ? this.replacePlaceholders(dto.ctaLabel, vars)
        : undefined,
      ctaUrl: dto.ctaUrl
        ? this.replacePlaceholders(dto.ctaUrl, vars)
        : undefined,
      churchName: person.church?.name,
      contactEmail: person.church?.email || undefined,
      contactPhone: person.church?.phone || undefined,
      imageUrl: resolvedImageUrl,
      churchId,
      personId: person.id,
      sentByUserId,
    };

    await this.emailProvider.sendCustomBroadcast(emailData);

    return {
      message: `Email successfully sent to ${person.firstName} ${person.lastName} (${person.email})`,
      recipient: {
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        email: person.email,
      },
    };
  }

  async sendToPeopleBatch(
    dto: SendBatchPeopleEmailDto,
    userChurchId?: string,
    sentByUserId?: string,
  ): Promise<{ message: string; results: BatchCustomEmailResult }> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where: Prisma.PersonWhereInput = {
      churchId,
    };

    if (dto.personIds && dto.personIds.length > 0) {
      where.id = { in: dto.personIds };
    }

    if (dto.membershipStatus) {
      where.membershipStatus = dto.membershipStatus;
    }

    if (dto.search) {
      where.OR = [
        { firstName: { contains: dto.search } },
        { lastName: { contains: dto.search } },
        { email: { contains: dto.search } },
        { phone: { contains: dto.search } },
      ];
    }

    const people = await this.prisma.person.findMany({
      where,
      include: { church: true },
    });

    if (people.length === 0) {
      throw new BadRequestException(
        'No matching people found for the specified filter criteria.',
      );
    }

    const resolvedImageUrl = this.resolveImageUrl(dto.imageUrl);
    const customEmailDataList: CustomEmailData[] = [];

    for (const person of people) {
      if (!person.email || person.email.trim() === '') {
        continue;
      }

      const vars: Record<string, string> = {
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: `${person.firstName} ${person.lastName}`,
        email: person.email,
        churchName: person.church?.name || '',
      };

      customEmailDataList.push({
        recipientEmail: person.email,
        recipientName: `${person.firstName} ${person.lastName}`,
        subject: this.replacePlaceholders(dto.subject, vars),
        heading: dto.heading
          ? this.replacePlaceholders(dto.heading, vars)
          : undefined,
        message: this.replacePlaceholders(dto.message, vars),
        ctaLabel: dto.ctaLabel
          ? this.replacePlaceholders(dto.ctaLabel, vars)
          : undefined,
        ctaUrl: dto.ctaUrl
          ? this.replacePlaceholders(dto.ctaUrl, vars)
          : undefined,
        churchName: person.church?.name,
        contactEmail: person.church?.email || undefined,
        contactPhone: person.church?.phone || undefined,
        imageUrl: resolvedImageUrl,
        churchId,
        personId: person.id,
        sentByUserId,
      });
    }

    const results =
      await this.emailProvider.sendBatchCustomBroadcast(customEmailDataList);

    return {
      message: `Batch email processing completed. ${results.totalSent} sent successfully out of ${results.totalWithEmail} valid recipients.`,
      results,
    };
  }

  async sendToRegistrant(
    dto: SendRegistrantEmailDto,
    userChurchId?: string,
    sentByUserId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const registration = await this.prisma.registration.findFirst({
      where: {
        id: dto.registrationId,
        event: { churchId },
      },
      include: {
        person: true,
        event: { include: { church: true } },
        team: true,
      },
    });

    if (!registration) {
      throw new NotFoundException(
        `Registration with ID "${dto.registrationId}" not found`,
      );
    }

    const person = registration.person;
    if (!person.email || person.email.trim() === '') {
      throw new BadRequestException(
        `Registrant "${person.firstName} ${person.lastName}" does not have a valid email address.`,
      );
    }

    const formattedDate = registration.event.startDate
      ? new Date(registration.event.startDate).toLocaleString('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : undefined;

    let qrCodeDataUrl: string | undefined = undefined;
    if (dto.includeQrPass !== false) {
      qrCodeDataUrl = await QRCode.toDataURL(registration.token);
    }

    const vars: Record<string, string> = {
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      email: person.email,
      eventTitle: registration.event.title,
      registrationNumber: registration.registrationNumber,
      teamName: registration.team?.name || '',
      churchName: registration.event.church?.name || '',
    };

    const emailData: CustomEmailData = {
      recipientEmail: person.email,
      recipientName: `${person.firstName} ${person.lastName}`,
      subject: this.replacePlaceholders(dto.subject, vars),
      heading: dto.heading
        ? this.replacePlaceholders(dto.heading, vars)
        : undefined,
      message: this.replacePlaceholders(dto.message, vars),
      ctaLabel: dto.ctaLabel
        ? this.replacePlaceholders(dto.ctaLabel, vars)
        : undefined,
      ctaUrl: dto.ctaUrl
        ? this.replacePlaceholders(dto.ctaUrl, vars)
        : undefined,
      churchName: registration.event.church?.name,
      contactEmail: registration.event.church?.email || undefined,
      contactPhone: registration.event.church?.phone || undefined,
      eventTitle: registration.event.title,
      eventDate: formattedDate,
      eventLocation: registration.event.location || undefined,
      registrationNumber: registration.registrationNumber,
      qrCodeDataUrl,
      teamName: registration.team?.name,
      teamColor: registration.team?.color || undefined,
      imageUrl: this.resolveImageUrl(dto.imageUrl),
      churchId,
      personId: person.id,
      registrationId: registration.id,
      sentByUserId,
    };

    await this.emailProvider.sendCustomBroadcast(emailData);

    return {
      message: `Email successfully sent to registrant ${person.firstName} ${person.lastName} (${person.email})`,
      registration: {
        id: registration.id,
        registrationNumber: registration.registrationNumber,
        eventTitle: registration.event.title,
        recipientName: `${person.firstName} ${person.lastName}`,
        email: person.email,
      },
    };
  }

  async sendToRegistrantsBatch(
    dto: SendBatchRegistrantsEmailDto,
    userChurchId?: string,
    sentByUserId?: string,
  ): Promise<{ message: string; results: BatchCustomEmailResult }> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where: Prisma.RegistrationWhereInput = {
      event: { churchId },
    };

    if (dto.registrationIds && dto.registrationIds.length > 0) {
      where.id = { in: dto.registrationIds };
    }

    if (dto.eventId) {
      where.eventId = dto.eventId;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.teamId) {
      where.teamId = dto.teamId;
    }

    if (dto.search) {
      where.OR = [
        { registrationNumber: { contains: dto.search } },
        { person: { firstName: { contains: dto.search } } },
        { person: { lastName: { contains: dto.search } } },
        { person: { email: { contains: dto.search } } },
        { person: { phone: { contains: dto.search } } },
      ];
    }

    const registrations = await this.prisma.registration.findMany({
      where,
      include: {
        person: true,
        event: { include: { church: true } },
        team: true,
      },
    });

    if (registrations.length === 0) {
      throw new BadRequestException(
        'No matching registrants found for the specified filter criteria.',
      );
    }

    const resolvedImageUrl = this.resolveImageUrl(dto.imageUrl);
    const customEmailDataList: CustomEmailData[] = [];

    for (const reg of registrations) {
      const person = reg.person;
      if (!person.email || person.email.trim() === '') {
        continue;
      }

      const formattedDate = reg.event.startDate
        ? new Date(reg.event.startDate).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
          })
        : undefined;

      let qrCodeDataUrl: string | undefined = undefined;
      if (dto.includeQrPass) {
        // Resend's batch send API supports neither attachments nor
        // data: URI images (major email clients strip data: URIs from
        // batch-sent mail), so batch emails link to a hosted QR image
        // instead of embedding one inline.
        const appUrl = this.configService
          .get<string>('appUrl')
          ?.replace(/\/+$/, '');
        qrCodeDataUrl = `${appUrl}/api/v1/qr/${encodeURIComponent(reg.token)}.png`;
      }

      const vars: Record<string, string> = {
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: `${person.firstName} ${person.lastName}`,
        email: person.email,
        eventTitle: reg.event.title,
        registrationNumber: reg.registrationNumber,
        teamName: reg.team?.name || '',
        churchName: reg.event.church?.name || '',
      };

      customEmailDataList.push({
        recipientEmail: person.email,
        recipientName: `${person.firstName} ${person.lastName}`,
        subject: this.replacePlaceholders(dto.subject, vars),
        heading: dto.heading
          ? this.replacePlaceholders(dto.heading, vars)
          : undefined,
        message: this.replacePlaceholders(dto.message, vars),
        ctaLabel: dto.ctaLabel
          ? this.replacePlaceholders(dto.ctaLabel, vars)
          : undefined,
        ctaUrl: dto.ctaUrl
          ? this.replacePlaceholders(dto.ctaUrl, vars)
          : undefined,
        churchName: reg.event.church?.name,
        contactEmail: reg.event.church?.email || undefined,
        contactPhone: reg.event.church?.phone || undefined,
        eventTitle: reg.event.title,
        eventDate: formattedDate,
        eventLocation: reg.event.location || undefined,
        registrationNumber: reg.registrationNumber,
        qrCodeDataUrl,
        teamName: reg.team?.name,
        teamColor: reg.team?.color || undefined,
        imageUrl: resolvedImageUrl,
        churchId,
        personId: person.id,
        registrationId: reg.id,
        sentByUserId,
      });
    }

    const results =
      await this.emailProvider.sendBatchCustomBroadcast(customEmailDataList);

    return {
      message: `Batch registrant email processing completed. ${results.totalSent} sent successfully out of ${results.totalWithEmail} valid recipients.`,
      results,
    };
  }

  async getEmailLogs(
    query: QueryEmailLogsDto,
    userChurchId?: string,
  ): Promise<EmailLogListResponseDto> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EmailSendLogWhereInput = {
      churchId,
    };

    if (query.emailType && query.emailType !== EmailLogTypeFilter.ALL) {
      where.emailType = query.emailType;
    }

    if (query.personId) {
      where.personId = query.personId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.registrationId) {
      where.registrationId = query.registrationId;
    }

    if (query.sentByUserId) {
      where.sentByUserId = query.sentByUserId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query.search && query.search.trim() !== '') {
      const search = query.search.trim();
      where.OR = [
        { recipientEmail: { contains: search } },
        { recipientName: { contains: search } },
        { subject: { contains: search } },
      ];
    }

    if (
      query.deliveryStatus &&
      query.deliveryStatus !== EmailLogDeliveryStatusFilter.ALL
    ) {
      const bounces = await this.prisma.emailBounce.findMany({
        where: { churchId },
        select: { resendEmailId: true },
      });
      const bouncedIds = bounces
        .map((b) => b.resendEmailId)
        .filter((id): id is string => Boolean(id));

      if (query.deliveryStatus === EmailLogDeliveryStatusFilter.BOUNCED) {
        where.resendEmailId = { in: bouncedIds };
      } else if (
        query.deliveryStatus === EmailLogDeliveryStatusFilter.DELIVERABLE
      ) {
        where.resendEmailId = { notIn: bouncedIds };
      }
    }

    const [total, sendLogs] = await Promise.all([
      this.prisma.emailSendLog.count({ where }),
      this.prisma.emailSendLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    if (sendLogs.length === 0) {
      return {
        data: [],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    // 1. Fetch bounces for these logs
    const resendIds = sendLogs.map((l) => l.resendEmailId).filter(Boolean);
    const bounces = await this.prisma.emailBounce.findMany({
      where: { resendEmailId: { in: resendIds } },
    });
    const bounceMap = new Map<string, (typeof bounces)[0]>();
    for (const b of bounces) {
      if (b.resendEmailId) {
        bounceMap.set(b.resendEmailId, b);
      }
    }

    // 2. Collect IDs needing fallback hydration or sender lookup
    const missingPersonIds = Array.from(
      new Set(
        sendLogs
          .filter((l) => l.personId && (!l.recipientName || !l.recipientEmail))
          .map((l) => l.personId as string),
      ),
    );
    const userIdsToFetch = Array.from(
      new Set(
        sendLogs
          .flatMap((l) => [
            l.userId && (!l.recipientName || !l.recipientEmail)
              ? l.userId
              : null,
            l.sentByUserId ? l.sentByUserId : null,
          ])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const registrationIds = Array.from(
      new Set(
        sendLogs
          .filter((l) => Boolean(l.registrationId))
          .map((l) => l.registrationId as string),
      ),
    );

    const [people, users, registrations] = await Promise.all([
      missingPersonIds.length > 0
        ? this.prisma.person.findMany({
            where: { id: { in: missingPersonIds } },
          })
        : [],
      userIdsToFetch.length > 0
        ? this.prisma.user.findMany({
            where: { id: { in: userIdsToFetch } },
          })
        : [],
      registrationIds.length > 0
        ? this.prisma.registration.findMany({
            where: { id: { in: registrationIds } },
            include: { person: true, event: true },
          })
        : [],
    ]);

    const peopleMap = new Map(people.map((p) => [p.id, p]));
    const usersMap = new Map(users.map((u) => [u.id, u]));
    const registrationsMap = new Map(registrations.map((r) => [r.id, r]));

    const data: EmailLogItemDto[] = sendLogs.map((log) => {
      const bounce = bounceMap.get(log.resendEmailId);
      const reg = log.registrationId
        ? registrationsMap.get(log.registrationId)
        : undefined;
      const person = log.personId ? peopleMap.get(log.personId) : reg?.person;
      const user = log.userId ? usersMap.get(log.userId) : undefined;
      const senderUser = log.sentByUserId
        ? usersMap.get(log.sentByUserId)
        : undefined;

      let recipientName: string | null | undefined = log.recipientName;
      let recipientEmail: string | null | undefined = log.recipientEmail;
      let recipientType = 'UNKNOWN';
      let recipientId: string | undefined =
        log.personId || log.userId || log.registrationId || undefined;

      if (log.registrationId) {
        recipientType = 'REGISTRANT';
        if (!recipientName && reg?.person) {
          recipientName =
            `${reg.person.firstName} ${reg.person.lastName}`.trim();
        }
        if (!recipientEmail && reg?.person) {
          recipientEmail = reg.person.email || undefined;
        }
        if (reg?.person) {
          recipientId = reg.person.id;
        }
      } else if (log.personId) {
        recipientType = 'PERSON';
        if (!recipientName && person) {
          recipientName = `${person.firstName} ${person.lastName}`.trim();
        }
        if (!recipientEmail && person) {
          recipientEmail = person.email || undefined;
        }
      } else if (log.userId) {
        recipientType = 'USER';
        if (!recipientName && user) {
          recipientName = `${user.firstName} ${user.lastName}`.trim();
        }
        if (!recipientEmail && user) {
          recipientEmail = user.email;
        }
      }

      const sentBy = senderUser
        ? {
            id: senderUser.id,
            name: `${senderUser.firstName} ${senderUser.lastName}`.trim(),
            email: senderUser.email,
          }
        : null;

      const content = log.broadcastContent as {
        subject?: string;
        heading?: string;
        message?: string;
        ctaLabel?: string;
        ctaUrl?: string;
        imageUrl?: string;
      } | null;

      let subject = log.subject || content?.subject;
      if (!subject) {
        if (log.emailType === 'REGISTRATION_CONFIRMATION') {
          subject = reg?.event
            ? `Registration Confirmation: ${reg.event.title}`
            : 'Registration Confirmation';
        } else if (log.emailType === 'ADMIN_WELCOME') {
          subject = 'Admin Account Credentials';
        } else if (log.emailType === 'BIRTHDAY_GREETING') {
          subject = 'Happy Birthday!';
        } else {
          subject = 'Email Notification';
        }
      }

      return {
        id: log.id,
        resendEmailId: log.resendEmailId,
        emailType: log.emailType,
        subject,
        recipient: {
          id: recipientId,
          name: recipientName || 'Unknown Recipient',
          email: recipientEmail || 'N/A',
          type: recipientType,
        },
        sentBy,
        event: reg
          ? {
              id: reg.eventId,
              title: reg.event.title,
              registrationNumber: reg.registrationNumber,
            }
          : undefined,
        content: content
          ? {
              heading: content.heading || undefined,
              message: content.message || undefined,
              ctaLabel: content.ctaLabel || undefined,
              ctaUrl: content.ctaUrl || undefined,
              imageUrl: content.imageUrl || undefined,
            }
          : undefined,
        deliveryStatus: bounce ? bounce.eventType : 'DELIVERABLE',
        bounceReason: bounce?.reason || undefined,
        sentAt: log.createdAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  private resolveImageUrl(imageUrl?: string): string | undefined {
    if (!imageUrl || imageUrl.trim() === '') {
      return undefined;
    }
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const appUrl =
      this.configService.get<string>('appUrl')?.replace(/\/+$/, '') || '';
    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${appUrl}${normalizedPath}`;
  }

  private replacePlaceholders(
    template: string,
    vars: Record<string, string>,
  ): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_match: string, key: string): string => {
        const val: string | undefined = vars[key];
        return val !== undefined ? val : `{{${key}}}`;
      },
    );
  }
}
