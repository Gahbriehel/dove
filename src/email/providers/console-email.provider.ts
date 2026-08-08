import { Injectable, Logger } from '@nestjs/common';
import {
  AdminWelcomeEmailData,
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
        `QR Data URL (first 40 chars): ${data.qrCodeDataUrl.substring(0, 40)}...\n` +
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
}
