import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { render } from '@react-email/render';
import * as React from 'react';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';
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

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('resend.apiKey');
    this.resend = new Resend(apiKey);
    this.fromAddress =
      this.configService.get<string>('resend.from') || 'onboarding@resend.dev';
  }

  /**
   * Persists what this outbound email actually was, keyed by Resend's returned
   * email id. Resend's bounce/complaint webhooks only echo back `email_id` (no
   * custom headers, and tags are a restricted 256-char ASCII-only store), so this
   * log — not email headers — is what lets a later bounce be linked back to its
   * original type/content for resending. Logging failures must never fail the send,
   * since the email itself already went out.
   */
  private async logEmailSend(
    resendEmailId: string | undefined,
    context: {
      emailType: string;
      churchId?: string;
      personId?: string;
      userId?: string;
      registrationId?: string;
      broadcastContent?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    if (!resendEmailId) return;
    try {
      await this.prisma.emailSendLog.create({
        data: {
          resendEmailId,
          emailType: context.emailType,
          churchId: context.churchId,
          personId: context.personId,
          userId: context.userId,
          registrationId: context.registrationId,
          broadcastContent: context.broadcastContent,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record email send log for Resend email ${resendEmailId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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

      const headers: Record<string, string> = {
        'X-Dove-Email-Type': 'REGISTRATION_CONFIRMATION',
      };
      if (data.churchId) headers['X-Dove-Church-Id'] = data.churchId;
      if (data.personId) headers['X-Dove-Person-Id'] = data.personId;
      if (data.registrationId)
        headers['X-Dove-Registration-Id'] = data.registrationId;

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

      await this.logEmailSend(response.data?.id, {
        emailType: 'REGISTRATION_CONFIRMATION',
        churchId: data.churchId,
        personId: data.personId,
        registrationId: data.registrationId,
      });

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

      const headers: Record<string, string> = {
        'X-Dove-Email-Type': 'ADMIN_WELCOME',
      };
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

      await this.logEmailSend(response.data?.id, {
        emailType: 'ADMIN_WELCOME',
        churchId: data.churchId,
        userId: data.userId,
      });

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
          imageUrl: data.imageUrl,
        }),
      );

      const headers: Record<string, string> = {
        'X-Dove-Email-Type': 'CUSTOM_BROADCAST',
      };
      if (data.churchId) headers['X-Dove-Church-Id'] = data.churchId;
      if (data.personId) headers['X-Dove-Person-Id'] = data.personId;
      if (data.userId) headers['X-Dove-User-Id'] = data.userId;
      if (data.registrationId)
        headers['X-Dove-Registration-Id'] = data.registrationId;

      const response = await this.resend.emails.send({
        from: this.fromAddress,
        to: data.recipientEmail,
        subject: data.subject,
        html,
        attachments,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      });

      if (response.error) {
        this.logger.error(
          `Resend API error sending broadcast email to ${data.recipientEmail}: ${response.error.message}`,
        );
        throw new Error(response.error.message);
      }

      await this.logEmailSend(response.data?.id, {
        emailType: 'CUSTOM_BROADCAST',
        churchId: data.churchId,
        personId: data.personId,
        userId: data.userId,
        registrationId: data.registrationId,
        broadcastContent: {
          subject: data.subject,
          heading: data.heading ?? null,
          message: data.message,
          ctaLabel: data.ctaLabel ?? null,
          ctaUrl: data.ctaUrl ?? null,
          imageUrl: data.imageUrl ?? null,
        },
      });

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
          // Resend's batch send API supports neither attachments nor
          // data: URI images, so item.qrCodeDataUrl is a hosted
          // https:// URL here (see EmailService.sendToRegistrantsBatch),
          // not a base64 data URI like the single-send path uses.
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
              qrCodeDataUrl: item.qrCodeDataUrl,
              teamName: item.teamName,
              teamColor: item.teamColor,
              imageUrl: item.imageUrl,
            }),
          );

          const headers: Record<string, string> = {
            'X-Dove-Email-Type': 'CUSTOM_BROADCAST',
          };
          if (item.churchId) headers['X-Dove-Church-Id'] = item.churchId;
          if (item.personId) headers['X-Dove-Person-Id'] = item.personId;
          if (item.userId) headers['X-Dove-User-Id'] = item.userId;
          if (item.registrationId)
            headers['X-Dove-Registration-Id'] = item.registrationId;

          return {
            from: this.fromAddress,
            to: item.recipientEmail,
            subject: item.subject,
            html,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
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
          await Promise.all(
            response.data.data.map(
              async (result: Record<string, unknown>, idx: number) => {
                const item = chunk[idx];
                const resObj = result as {
                  id?: string;
                  error?: { message?: string };
                };
                if (resObj && resObj.error) {
                  totalFailed++;
                  failedRecipients.push({
                    recipient: item.recipientEmail,
                    reason:
                      resObj.error.message || 'Error sending to recipient',
                  });
                } else {
                  totalSent++;
                  await this.logEmailSend(resObj.id, {
                    emailType: 'CUSTOM_BROADCAST',
                    churchId: item.churchId,
                    personId: item.personId,
                    userId: item.userId,
                    registrationId: item.registrationId,
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
              },
            ),
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
