import { Injectable, Logger } from '@nestjs/common';
import {
  AdminWelcomeEmailData,
  BatchCustomEmailResult,
  CustomEmailData,
  IEmailService,
  RegistrationConfirmationEmailData,
} from '../interfaces/email-service.interface';

@Injectable()
export class ConsoleEmailProvider implements IEmailService {
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  sendRegistrationConfirmation(
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
    return Promise.resolve();
  }

  sendAdminWelcome(data: AdminWelcomeEmailData): Promise<void> {
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
    return Promise.resolve();
  }

  sendCustomBroadcast(data: CustomEmailData): Promise<void> {
    this.logger.log(
      `------------------------------------------------------------\n` +
        `[CUSTOM BROADCAST EMAIL DISPATCHED]\n` +
        `To: ${data.recipientName} <${data.recipientEmail}>\n` +
        `Subject: ${data.subject}\n` +
        `Heading: ${data.heading || 'N/A'}\n` +
        `Message: ${data.message}\n` +
        `CTA: ${data.ctaLabel ? `${data.ctaLabel} (${data.ctaUrl})` : 'N/A'}\n` +
        `Event: ${data.eventTitle || 'N/A'}\n` +
        `Registration #: ${data.registrationNumber || 'N/A'}\n` +
        `------------------------------------------------------------`,
    );
    return Promise.resolve();
  }

  sendBatchCustomBroadcast(
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
        `------------------------------------------------------------`,
    );

    return Promise.resolve({
      totalTargeted,
      totalWithEmail,
      totalSent: totalWithEmail,
      totalFailed: 0,
      failedRecipients: [],
    });
  }
}
