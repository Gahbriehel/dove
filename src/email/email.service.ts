import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
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
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
  ) {}

  async sendToPerson(dto: SendPersonEmailDto, userChurchId?: string) {
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
      });
    }

    const results =
      await this.emailProvider.sendBatchCustomBroadcast(customEmailDataList);

    return {
      message: `Batch email processing completed. ${results.totalSent} sent successfully out of ${results.totalWithEmail} valid recipients.`,
      results,
    };
  }

  async sendToRegistrant(dto: SendRegistrantEmailDto, userChurchId?: string) {
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
        qrCodeDataUrl = await QRCode.toDataURL(reg.token);
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
      });
    }

    const results =
      await this.emailProvider.sendBatchCustomBroadcast(customEmailDataList);

    return {
      message: `Batch registrant email processing completed. ${results.totalSent} sent successfully out of ${results.totalWithEmail} valid recipients.`,
      results,
    };
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
