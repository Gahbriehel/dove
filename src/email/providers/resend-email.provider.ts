import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';
import {
  IEmailService,
  RegistrationConfirmationEmailData,
} from '../interfaces/email-service.interface';
import { RegistrationConfirmationEmail } from '../templates/registration-confirmation.template';

@Injectable()
export class ResendEmailProvider implements IEmailService {
  private readonly logger = new Logger(ResendEmailProvider.name);
  private readonly resend: Resend;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    this.fromAddress =
      this.configService.get<string>('EMAIL_FROM') || 'onboarding@resend.dev';
  }

  async sendRegistrationConfirmation(
    data: RegistrationConfirmationEmailData,
  ): Promise<void> {
    try {
      const html = await render(
        React.createElement(RegistrationConfirmationEmail, {
          recipientName: data.recipientName,
          eventTitle: data.eventTitle,
          registrationNumber: data.registrationNumber,
          qrCodeDataUrl: data.qrCodeDataUrl,
          teamName: data.teamName,
          teamColor: data.teamColor,
        }),
      );

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `Registration Confirmation: ${data.eventTitle}`,
        html,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending confirmation email to ${data.recipientEmail}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      this.logger.log(
        `Successfully sent registration confirmation email to ${data.recipientEmail} (Email ID: ${response.data?.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${data.recipientEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
