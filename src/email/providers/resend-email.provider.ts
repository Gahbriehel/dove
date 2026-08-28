import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';
import {
  AdminWelcomeEmailData,
  BatchCustomEmailResult,
  BounceAdminAlertEmailData,
  CustomEmailData,
  IEmailService,
  RegistrationConfirmationEmailData,
} from '../interfaces/email-service.interface';
import { AdminWelcomeEmail } from '../templates/admin-welcome.template';
import { BounceAdminAlertEmail } from '../templates/bounce-admin-alert.template';
import { CustomBroadcastEmail } from '../templates/custom-broadcast.template';
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

      if (data.icsBuffer) {
        if (!attachments) {
          attachments = [];
        }
        attachments.push({
          filename: 'event-invite.ics',
          content: data.icsBuffer,
          contentType: 'text/calendar',
        });
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
          googleCalendarUrl: data.googleCalendarUrl,
        }),
      );

      const headers: Record<string, string> = {};
      if (data.churchId) headers['X-Dove-Church-Id'] = data.churchId;
      if (data.personId) headers['X-Dove-Person-Id'] = data.personId;

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `Registration Confirmation: ${data.eventTitle}`,
        html,
        attachments,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
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

      const headers: Record<string, string> = {};
      if (data.churchId) headers['X-Dove-Church-Id'] = data.churchId;
      if (data.userId) headers['X-Dove-User-Id'] = data.userId;

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `Welcome to ${data.churchName || 'Dove Platform'} - Your Admin Account Credentials`,
        html,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
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

  async sendCustomBroadcast(data: CustomEmailData): Promise<void> {
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
            `Failed to parse QR code data URL for broadcast inline attachment: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      const html = await render(
        React.createElement(CustomBroadcastEmail, {
          recipientName: data.recipientName,
          subject: data.subject,
          heading: data.heading,
          message: data.message,
          ctaLabel: data.ctaLabel,
          ctaUrl: data.ctaUrl,
          churchName: data.churchName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          eventTitle: data.eventTitle,
          eventDate: data.eventDate,
          eventLocation: data.eventLocation,
          registrationNumber: data.registrationNumber,
          qrCodeDataUrl: qrCodeDataUrlProp,
          teamName: data.teamName,
          teamColor: data.teamColor,
        }),
      );

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: data.subject,
        html,
        attachments,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending broadcast email to ${data.recipientEmail}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      this.logger.log(
        `Successfully sent custom broadcast email to ${data.recipientEmail} (Email ID: ${response.data?.id})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send broadcast email to ${data.recipientEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async sendBatchCustomBroadcast(
    data: CustomEmailData[],
  ): Promise<BatchCustomEmailResult> {
    const totalTargeted = data.length;
    const validData = data.filter(
      (item) => item.recipientEmail && item.recipientEmail.trim() !== '',
    );
    const totalWithEmail = validData.length;

    let totalSent = 0;
    let totalFailed = 0;
    const failedRecipients: Array<{ recipient: string; reason: string }> = [];

    // User requested batch size limit = 60 recipients per chunk
    const BATCH_LIMIT = 60;
    for (let i = 0; i < validData.length; i += BATCH_LIMIT) {
      const chunk = validData.slice(i, i + BATCH_LIMIT);

      const emailPayloads = await Promise.all(
        chunk.map(async (item) => {
          let attachments: any[] | undefined = undefined;
          let qrCodeDataUrlProp = item.qrCodeDataUrl;

          if (item.qrCodeDataUrl && item.qrCodeDataUrl.startsWith('data:')) {
            try {
              const parts = item.qrCodeDataUrl.split(',');
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
            } catch {
              // ignore fallback
            }
          }

          const html = await render(
            React.createElement(CustomBroadcastEmail, {
              recipientName: item.recipientName,
              subject: item.subject,
              heading: item.heading,
              message: item.message,
              ctaLabel: item.ctaLabel,
              ctaUrl: item.ctaUrl,
              churchName: item.churchName,
              contactEmail: item.contactEmail,
              contactPhone: item.contactPhone,
              eventTitle: item.eventTitle,
              eventDate: item.eventDate,
              eventLocation: item.eventLocation,
              registrationNumber: item.registrationNumber,
              qrCodeDataUrl: qrCodeDataUrlProp,
              teamName: item.teamName,
              teamColor: item.teamColor,
            }),
          );

          return {
            from: this.fromAddress,
            to: item.recipientEmail,
            subject: item.subject,
            html,
            attachments,
          };
        }),
      );

      try {
        const response = await this.resend.batch.send(emailPayloads);
        if (response.error) {
          this.logger.error(
            `Resend batch send API error: ${response.error.message}`,
          );
          chunk.forEach((item) => {
            totalFailed++;
            failedRecipients.push({
              recipient: item.recipientEmail,
              reason: response.error?.message || 'Batch send failed',
            });
          });
        } else if (response.data?.data) {
          response.data.data.forEach(
            (result: Record<string, unknown>, idx: number) => {
              const recipient = chunk[idx].recipientEmail;
              const resObj = result as { error?: { message?: string } };
              if (resObj && resObj.error) {
                totalFailed++;
                failedRecipients.push({
                  recipient,
                  reason: resObj.error.message || 'Error sending to recipient',
                });
              } else {
                totalSent++;
              }
            },
          );
        } else {
          totalSent += chunk.length;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Batch send chunk exception: ${errMsg}`);
        chunk.forEach((item) => {
          totalFailed++;
          failedRecipients.push({
            recipient: item.recipientEmail,
            reason: errMsg,
          });
        });
      }
    }

    return {
      totalTargeted,
      totalWithEmail,
      totalSent,
      totalFailed,
      failedRecipients,
    };
  }

  async sendBounceAdminAlert(data: BounceAdminAlertEmailData): Promise<void> {
    try {
      const html = await render(
        React.createElement(BounceAdminAlertEmail, {
          bouncedEmail: data.bouncedEmail,
          eventType: data.eventType,
          reason: data.reason,
          recipientName: data.recipientName,
          recipientType: data.recipientType,
          churchName: data.churchName,
        }),
      );

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: `🚨 Resend Bounce Alert: Delivery Failed for ${data.bouncedEmail}`,
        html,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending bounce alert to admin ${data.recipientEmail}: ${response.error.message}`,
        );
      } else {
        this.logger.log(
          `Successfully sent bounce admin alert to ${data.recipientEmail} regarding ${data.bouncedEmail}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send bounce alert email to admin ${data.recipientEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
