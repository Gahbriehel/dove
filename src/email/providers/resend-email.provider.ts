import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';
import {
  AdminWelcomeEmailData,
  IEmailService,
  RegistrationConfirmationEmailData,
} from '../interfaces/email-service.interface';
import { AdminWelcomeEmail } from '../templates/admin-welcome.template';
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
      let attachments: any[] | undefined = undefined;
      let qrCodeDataUrlProp = data.qrCodeDataUrl;

      if (data.qrCodeDataUrl && data.qrCodeDataUrl.startsWith('data:')) {
        try {
          const parts = data.qrCodeDataUrl.split(',');
          const base64Part = parts[1];
          const header = parts[0];

          if (base64Part) {
            const buffer = Buffer.from(base64Part, 'base64');
            const mimeMatch = header.match(/data:(.*?);/);
            const contentType = mimeMatch ? mimeMatch[1] : 'image/png';

            attachments = [
              {
                filename: 'qrcode.png',
                content: buffer,
                contentType,
                contentId: 'qrcode',
              },
            ];
            qrCodeDataUrlProp = 'cid:qrcode';
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse QR code data URL for inline attachment, falling back: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const html = await render(
        React.createElement(RegistrationConfirmationEmail, {
          recipientName: data.recipientName,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          eventLocation: data.eventLocation,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          registrationNumber: data.registrationNumber,
          qrCodeDataUrl: qrCodeDataUrlProp,
          teamName: data.teamName,
          teamColor: data.teamColor,
        }),
      );

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `Registration Confirmation: ${data.eventTitle}`,
        html,
        attachments,
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

  async sendAdminWelcome(data: AdminWelcomeEmailData): Promise<void> {
    try {
      const html = await render(
        React.createElement(AdminWelcomeEmail, {
          recipientName: data.recipientName,
          recipientEmail: data.recipientEmail,
          temporaryPassword: data.temporaryPassword,
          loginUrl: data.loginUrl,
          churchName: data.churchName,
        }),
      );

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `Welcome to ${data.churchName || 'Dove Platform'} - Your Admin Account Credentials`,
        html,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending welcome email to ${data.recipientEmail}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      this.logger.log(
        `Successfully sent admin welcome email to ${data.recipientEmail} (Email ID: ${response.data?.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send admin welcome email to ${data.recipientEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
