import { Injectable, Logger } from '@nestjs/common';
import {
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
        `Registration #: ${data.registrationNumber}\n` +
        `Team: ${data.teamName || 'N/A'}${data.teamColor ? ` (${data.teamColor})` : ''}\n` +
        `QR Token: ${data.qrToken}\n` +
        `QR Data URL (first 40 chars): ${data.qrCodeDataUrl.substring(0, 40)}...\n` +
        `------------------------------------------------------------`,
    );
    return Promise.resolve();
  }
}
