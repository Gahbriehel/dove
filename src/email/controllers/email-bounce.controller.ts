import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { EmailBounce } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RemediateEmailBounceDto } from '../dto/remediate-email-bounce.dto';
import {
  EMAIL_SERVICE,
  type IEmailService,
} from '../interfaces/email-service.interface';
import {
  generateGoogleCalendarUrl,
  generateIcsBuffer,
} from '../utils/calendar.util';

interface BroadcastContentSnapshot {
  subject?: string;
  heading?: string;
  message?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
}

@ApiTags('Email Bounces')
@ApiBearerAuth()
@Controller('email-bounces')
export class EmailBounceController {
  private readonly logger = new Logger(EmailBounceController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ResponseMessage('Active email bounce alerts retrieved successfully')
  @ApiOperation({ summary: 'Get list of active (unresolved) email bounces' })
  @ApiResponse({ status: 200, description: 'List of unresolved email bounces' })
  async getUnresolvedBounces(@CurrentUser('churchId') churchId: string) {
    return this.prisma.emailBounce.findMany({
      where: {
        churchId,
        isResolved: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email bounce alert marked as resolved')
  @ApiOperation({ summary: 'Mark an email bounce alert as resolved' })
  @ApiResponse({ status: 200, description: 'Bounce resolved' })
  @ApiResponse({ status: 404, description: 'Bounce record not found' })
  async resolveBounce(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    const bounce = await this.prisma.emailBounce.findFirst({
      where: { id, churchId },
    });

    if (!bounce) {
      throw new NotFoundException(
        `Email bounce record with ID ${id} not found`,
      );
    }

    return this.prisma.emailBounce.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });
  }

  @Post(':id/remediate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email address corrected and bounce alert resolved')
  @ApiOperation({
    summary:
      'Correct bounced email address, reset status, and optionally resend email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email address updated and bounce resolved',
  })
  @ApiResponse({ status: 404, description: 'Bounce record not found' })
  async remediateBounce(
    @Param('id') id: string,
    @Body() dto: RemediateEmailBounceDto,
    @CurrentUser('sub') adminUserId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    const bounce = await this.prisma.emailBounce.findFirst({
      where: { id, churchId },
    });

    if (!bounce) {
      throw new NotFoundException(
        `Email bounce record with ID ${id} not found`,
      );
    }

    const { newEmail, resendOriginal, subject } = dto;
    const oldEmail = bounce.email;

    // 1. Update Person if matching recipientId or old email
    if (bounce.recipientType === 'PERSON' && bounce.recipientId) {
      await this.prisma.person.update({
        where: { id: bounce.recipientId },
        data: {
          email: newEmail,
          emailStatus: 'DELIVERABLE',
          emailBounceReason: null,
          emailBouncedAt: null,
        },
      });
    } else {
      const matchingPeople = await this.prisma.person.findMany({
        where: { churchId, email: oldEmail },
      });
      for (const p of matchingPeople) {
        await this.prisma.person.update({
          where: { id: p.id },
          data: {
            email: newEmail,
            emailStatus: 'DELIVERABLE',
            emailBounceReason: null,
            emailBouncedAt: null,
          },
        });
      }
    }

    // 2. Update User if matching recipientId or old email
    if (bounce.recipientType === 'USER' && bounce.recipientId) {
      await this.prisma.user.update({
        where: { id: bounce.recipientId },
        data: {
          email: newEmail,
          emailStatus: 'DELIVERABLE',
          emailBounceReason: null,
          emailBouncedAt: null,
        },
      });
    } else {
      const matchingUsers = await this.prisma.user.findMany({
        where: { churchId, email: oldEmail },
      });
      for (const u of matchingUsers) {
        await this.prisma.user.update({
          where: { id: u.id },
          data: {
            email: newEmail,
            emailStatus: 'DELIVERABLE',
            emailBounceReason: null,
            emailBouncedAt: null,
          },
        });
      }
    }

    // 3. Mark bounce record as resolved
    const updatedBounce = await this.prisma.emailBounce.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });

    // 4. Optionally resend the actual email that originally bounced
    let resend:
      { attempted: boolean; succeeded: boolean; reason?: string } | undefined;
    if (resendOriginal) {
      const outcome = await this.resendOriginalEmail(bounce, newEmail, subject);
      resend = { attempted: true, ...outcome };
    } else {
      resend = { attempted: false, succeeded: false };
    }

    return {
      success: true,
      message: `Successfully remediated email ${oldEmail} -> ${newEmail}`,
      bounce: updatedBounce,
      resend,
    };
  }

  /**
   * Resends the email that actually bounced, reconstructed from context captured
   * at send time (see X-Dove-Email-Type/X-Dove-Registration-Id/X-Dove-Broadcast-Content
   * headers in ResendEmailProvider and their parsing in EmailBounceService). Bounces
   * recorded before this tracking existed, or whose source record was since deleted,
   * cannot be reconstructed — in that case nothing is sent rather than substituting
   * a generic message the recipient never actually missed.
   */
  private async resendOriginalEmail(
    bounce: EmailBounce,
    newEmail: string,
    subjectOverride?: string,
  ): Promise<{ succeeded: boolean; reason?: string }> {
    switch (bounce.emailType) {
      case 'REGISTRATION_CONFIRMATION':
        return this.resendRegistrationConfirmation(bounce, newEmail);
      case 'ADMIN_WELCOME':
        return this.resendAdminWelcome(bounce, newEmail);
      case 'CUSTOM_BROADCAST':
        return this.resendCustomBroadcast(bounce, newEmail, subjectOverride);
      default:
        this.logger.warn(
          `Bounce ${bounce.id} has no recognized emailType ("${bounce.emailType}"); cannot resend the original email.`,
        );
        return {
          succeeded: false,
          reason:
            'The original email type for this bounce is unknown (likely recorded before resend tracking was added). No email was resent.',
        };
    }
  }

  private async resendRegistrationConfirmation(
    bounce: EmailBounce,
    newEmail: string,
  ): Promise<{ succeeded: boolean; reason?: string }> {
    if (!bounce.registrationId) {
      return {
        succeeded: false,
        reason: 'No registration is linked to this bounce.',
      };
    }

    const registration = await this.prisma.registration.findUnique({
      where: { id: bounce.registrationId },
      include: {
        event: { include: { church: true } },
        team: true,
        person: true,
      },
    });

    if (!registration) {
      return {
        succeeded: false,
        reason: `Registration ${bounce.registrationId} no longer exists.`,
      };
    }

    const qrCodeDataUrl = await QRCode.toDataURL(registration.token);
    const formattedDate = registration.event.startDate
      ? new Date(registration.event.startDate).toLocaleString('en-US', {
          timeZone: 'Africa/Lagos',
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : undefined;

    let googleCalendarUrl: string | undefined;
    let icsBuffer: Buffer | undefined;
    if (
      registration.event.googleCalendarSync &&
      registration.googleCalendarSync
    ) {
      googleCalendarUrl = generateGoogleCalendarUrl({
        title: registration.event.title,
        startDate: registration.event.startDate,
        endDate: registration.event.endDate,
        description: registration.event.description || '',
        location: registration.event.location || '',
      });

      try {
        icsBuffer = await generateIcsBuffer({
          title: registration.event.title,
          startDate: registration.event.startDate,
          endDate: registration.event.endDate,
          description: registration.event.description || '',
          location: registration.event.location || '',
          organizerName: registration.event.church.name,
          organizerEmail:
            registration.event.church.email || 'noreply@dove.platform',
        });
      } catch (icsError) {
        this.logger.error(
          `Failed to regenerate ICS file while resending bounce ${bounce.id}: ${icsError instanceof Error ? icsError.message : String(icsError)}`,
        );
      }
    }

    await this.emailService.sendRegistrationConfirmation({
      recipientEmail: newEmail,
      recipientName:
        `${registration.person.firstName} ${registration.person.lastName}`.trim(),
      eventTitle: registration.event.title,
      eventDate: formattedDate,
      eventLocation: registration.event.location || undefined,
      contactEmail: registration.event.church.email || undefined,
      contactPhone: registration.event.church.phone || undefined,
      registrationNumber: registration.registrationNumber,
      qrToken: registration.token,
      qrCodeDataUrl,
      teamName: registration.team?.name,
      teamColor: registration.team?.color || undefined,
      googleCalendarUrl,
      icsBuffer,
      registrationId: registration.id,
      churchId: registration.event.churchId,
      personId: registration.person.id,
    });

    return { succeeded: true };
  }

  private async resendAdminWelcome(
    bounce: EmailBounce,
    newEmail: string,
  ): Promise<{ succeeded: boolean; reason?: string }> {
    if (bounce.recipientType !== 'USER' || !bounce.recipientId) {
      return {
        succeeded: false,
        reason: 'No user is linked to this bounce.',
      };
    }

    // The original temporary password is never persisted (it's hashed immediately),
    // so a genuine "resend" issues a fresh one rather than reusing the old value.
    const temporaryPassword = crypto.randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.update({
      where: { id: bounce.recipientId },
      data: { passwordHash },
    });

    const church = await this.prisma.church.findUnique({
      where: { id: user.churchId },
    });

    const loginUrl =
      this.configService.get<string>('LOGIN_URL') ||
      'http://localhost:3000/login';

    await this.emailService.sendAdminWelcome({
      recipientEmail: newEmail,
      recipientName: `${user.firstName} ${user.lastName}`.trim(),
      temporaryPassword,
      churchName: church?.name,
      loginUrl,
      churchId: user.churchId,
      userId: user.id,
    });

    return { succeeded: true };
  }

  private async resendCustomBroadcast(
    bounce: EmailBounce,
    newEmail: string,
    subjectOverride?: string,
  ): Promise<{ succeeded: boolean; reason?: string }> {
    const content = bounce.broadcastContent as BroadcastContentSnapshot | null;
    if (!content || !content.message) {
      return {
        succeeded: false,
        reason:
          'The original broadcast content was not captured for this bounce.',
      };
    }

    let recipientName = 'Valued Member';
    let eventTitle: string | undefined;
    let eventDate: string | undefined;
    let eventLocation: string | undefined;
    let registrationNumber: string | undefined;
    let qrCodeDataUrl: string | undefined;
    let teamName: string | undefined;
    let teamColor: string | undefined;

    if (bounce.registrationId) {
      const registration = await this.prisma.registration.findUnique({
        where: { id: bounce.registrationId },
        include: { event: true, team: true, person: true },
      });
      if (registration) {
        recipientName =
          `${registration.person.firstName} ${registration.person.lastName}`.trim();
        eventTitle = registration.event.title;
        eventDate = registration.event.startDate
          ? new Date(registration.event.startDate).toLocaleString('en-US', {
              timeZone: 'Africa/Lagos',
              dateStyle: 'full',
              timeStyle: 'short',
            })
          : undefined;
        eventLocation = registration.event.location || undefined;
        registrationNumber = registration.registrationNumber;
        qrCodeDataUrl = await QRCode.toDataURL(registration.token);
        teamName = registration.team?.name;
        teamColor = registration.team?.color || undefined;
      }
    } else if (bounce.recipientType === 'PERSON' && bounce.recipientId) {
      const person = await this.prisma.person.findUnique({
        where: { id: bounce.recipientId },
      });
      if (person)
        recipientName = `${person.firstName} ${person.lastName}`.trim();
    }

    const church = bounce.churchId
      ? await this.prisma.church.findUnique({ where: { id: bounce.churchId } })
      : null;

    await this.emailService.sendCustomBroadcast({
      recipientEmail: newEmail,
      recipientName,
      subject: subjectOverride || content.subject || 'Update & Notification',
      heading: content.heading,
      message: content.message,
      ctaLabel: content.ctaLabel,
      ctaUrl: content.ctaUrl,
      churchName: church?.name,
      contactEmail: church?.email || undefined,
      contactPhone: church?.phone || undefined,
      eventTitle,
      eventDate,
      eventLocation,
      registrationNumber,
      qrCodeDataUrl,
      teamName,
      teamColor,
      imageUrl: content.imageUrl,
      churchId: bounce.churchId || undefined,
      registrationId: bounce.registrationId || undefined,
    });

    return { succeeded: true };
  }
}
