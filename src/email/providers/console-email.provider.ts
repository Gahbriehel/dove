import { Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminWelcomeEmailData,
  BatchCustomEmailResult,
  BounceAdminAlertEmailData,
  CustomEmailData,
  IEmailService,
  RegistrationConfirmationEmailData,
} from '../interfaces/email-service.interface';

@Injectable()
export class ConsoleEmailProvider implements IEmailService {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  private async logEmailSend(context: {
    emailType: string;
    churchId?: string;
    recipientEmail?: string;
    recipientName?: string;
    subject?: string;
    personId?: string;
    userId?: string;
    registrationId?: string;
    sentByUserId?: string;
    broadcastContent?: Prisma.InputJsonValue;
  }): Promise<void> {
    if (!this.prisma) return;
    try {
      await this.prisma.emailSendLog.create({
        data: {
          resendEmailId: `console_${crypto.randomUUID()}`,
          emailType: context.emailType,
          churchId: context.churchId,
          recipientEmail: context.recipientEmail,
          recipientName: context.recipientName,
          subject: context.subject,
          personId: context.personId,
          userId: context.userId,
          registrationId: context.registrationId,
          sentByUserId: context.sentByUserId,
          broadcastContent: context.broadcastContent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record console email send log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendRegistrationConfirmation(
    data: RegistrationConfirmationEmailData,
  ): Promise<void> {
    this.logger.log(
      `------------------------------------------------------------\n` +
        `[CONFIRMATION EMAIL DISPATCHED]\n` +
        `To: ${data.recipientName} <${data.recipientEmail}>\n` +
        `Event: ${data.eventTitle}\n` +
        `Date: ${data.eventDate || 'N/A'}\n` +
        `Location: ${data.eventLocation || 'N/A'}\n` +
        `Registration #: ${data.registrationNumber}\n` +
        `Team: ${data.teamName || 'N/A'}${data.teamColor ? ` (${data.teamColor})` : ''}\n` +
        `Contact Email: ${data.contactEmail || 'N/A'}\n` +
        `Contact Phone: ${data.contactPhone || 'N/A'}\n` +
        `QR Token: ${data.qrToken}\n` +
        `QR Data URL (first 40 chars): ${data.qrCodeDataUrl ? data.qrCodeDataUrl.substring(0, 40) : 'N/A'}...\n` +
        `Google Calendar URL: ${data.googleCalendarUrl || 'N/A'}\n` +
        `------------------------------------------------------------`,
    );

    await this.logEmailSend({
      emailType: 'REGISTRATION_CONFIRMATION',
      churchId: data.churchId,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      subject: `Registration Confirmation: ${data.eventTitle}`,
      personId: data.personId,
      registrationId: data.registrationId,
      sentByUserId: data.sentByUserId,
    });
  }

  async sendAdminWelcome(data: AdminWelcomeEmailData): Promise<void> {
    this.logger.log(
      `------------------------------------------------------------\n` +
        `[ADMIN WELCOME EMAIL DISPATCHED]\n` +
        `To: ${data.recipientName} <${data.recipientEmail}>\n` +
        `Church: ${data.churchName || 'Dove Platform'}\n` +
        `Temporary Password: ${data.temporaryPassword}\n` +
        `Login URL: ${data.loginUrl || 'N/A'}\n` +
        `WARNING: Password is temporary and must be changed on initial login.\n` +
        `------------------------------------------------------------`,
    );

    await this.logEmailSend({
      emailType: 'ADMIN_WELCOME',
      churchId: data.churchId,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      subject: `Welcome to ${data.churchName || 'Dove Platform'} - Your Admin Account Credentials`,
      userId: data.userId,
      sentByUserId: data.sentByUserId,
    });
  }

  async sendCustomBroadcast(data: CustomEmailData): Promise<void> {
    this.logger.log(
      `------------------------------------------------------------\n` +
        `[CUSTOM BROADCAST EMAIL DISPATCHED]\n` +
        `To: ${data.recipientName} <${data.recipientEmail}>\n` +
        `Subject: ${data.subject}\n` +
        `Heading: ${data.heading || 'N/A'}\n` +
        `Message: ${data.message}\n` +
        `CTA: ${data.ctaLabel ? `${data.ctaLabel} (${data.ctaUrl})` : 'N/A'}\n` +
        `Image URL: ${data.imageUrl || 'N/A'}\n` +
        `Event: ${data.eventTitle || 'N/A'}\n` +
        `Registration #: ${data.registrationNumber || 'N/A'}\n` +
        `------------------------------------------------------------`,
    );

    await this.logEmailSend({
      emailType: data.emailType || 'CUSTOM_BROADCAST',
      churchId: data.churchId,
      recipientEmail: data.recipientEmail,
      recipientName: data.recipientName,
      subject: data.subject,
      personId: data.personId,
      userId: data.userId,
      registrationId: data.registrationId,
      sentByUserId: data.sentByUserId,
      broadcastContent: {
        subject: data.subject,
        heading: data.heading ?? null,
        message: data.message,
        ctaLabel: data.ctaLabel ?? null,
        ctaUrl: data.ctaUrl ?? null,
        imageUrl: data.imageUrl ?? null,
      },
    });
  }

  async sendBatchCustomBroadcast(
    data: CustomEmailData[],
  ): Promise<BatchCustomEmailResult> {
    const totalTargeted = data.length;
    const validData = data.filter(
      (item) => item.recipientEmail && item.recipientEmail.trim() !== '',
    );
    const totalWithEmail = validData.length;

    this.logger.log(
      `------------------------------------------------------------\n` +
        `[BATCH CUSTOM EMAIL DISPATCHED]\n` +
        `Total Recipients Targeted: ${totalTargeted}\n` +
        `Total With Valid Email: ${totalWithEmail}\n` +
        `Sample Recipient: ${validData[0] ? `${validData[0].recipientName} <${validData[0].recipientEmail}>` : 'None'}\n` +
        `Subject: ${validData[0]?.subject || 'N/A'}\n` +
        `Image URL: ${validData[0]?.imageUrl || 'N/A'}\n` +
        `------------------------------------------------------------`,
    );

    for (const item of validData) {
      await this.logEmailSend({
        emailType: item.emailType || 'CUSTOM_BROADCAST',
        churchId: item.churchId,
        recipientEmail: item.recipientEmail,
        recipientName: item.recipientName,
        subject: item.subject,
        personId: item.personId,
        userId: item.userId,
        registrationId: item.registrationId,
        sentByUserId: item.sentByUserId,
        broadcastContent: {
          subject: item.subject,
          heading: item.heading ?? null,
          message: item.message,
          ctaLabel: item.ctaLabel ?? null,
          ctaUrl: item.ctaUrl ?? null,
          imageUrl: item.imageUrl ?? null,
        },
      });
    }

    return {
      totalTargeted,
      totalWithEmail,
      totalSent: totalWithEmail,
      totalFailed: 0,
      failedRecipients: [],
    };
  }

  sendBounceAdminAlert(data: BounceAdminAlertEmailData): Promise<void> {
    this.logger.log(
      `------------------------------------------------------------\n` +
        `[BOUNCE ADMIN ALERT EMAIL DISPATCHED]\n` +
        `To Admin: ${data.recipientEmail}\n` +
        `Bounced Email: ${data.bouncedEmail}\n` +
        `Event Type: ${data.eventType}\n` +
        `Reason: ${data.reason || 'N/A'}\n` +
        `Recipient Name: ${data.recipientName || 'N/A'}\n` +
        `Church: ${data.churchName || 'Dove Platform'}\n` +
        `------------------------------------------------------------`,
    );
    return Promise.resolve();
  }
}
