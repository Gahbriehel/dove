import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResendWebhookPayloadDto } from '../dto/resend-webhook.dto';
import {
  EMAIL_SERVICE,
  type IEmailService,
} from '../interfaces/email-service.interface';

@Injectable()
export class EmailBounceService {
  private readonly logger = new Logger(EmailBounceService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  async handleWebhookPayload(
    payload: ResendWebhookPayloadDto,
  ): Promise<{ success: boolean; message: string }> {
    const { type, data } = payload;

    // Only process delivery issue events. Resend has no "email.dropped" event;
    // email.failed (SMTP-level rejection) and email.suppressed (recipient on the
    // suppression list) are the real equivalents of what "dropped" was meant to cover.
    if (
      ![
        'email.bounced',
        'email.failed',
        'email.suppressed',
        'email.complained',
      ].includes(type)
    ) {
      return { success: true, message: `Ignored event type: ${type}` };
    }

    const recipients = data.to || [];
    if (recipients.length === 0) {
      return { success: false, message: 'No recipient email found in payload' };
    }

    const bouncedEmail = recipients[0].toLowerCase().trim();
    const resendEmailId = data.email_id;
    const bounceType = data.bounce?.type || data.suppressed?.type || 'Hard';
    const reason =
      data.bounce?.message ||
      data.failed?.reason ||
      data.suppressed?.message ||
      `Event: ${type}`;

    // Resend's webhook payload carries no custom headers and only a size-limited
    // tags map — the type/content of the original email is looked up from the
    // EmailSendLog record written when it was sent (see ResendEmailProvider).
    const sendLog = resendEmailId
      ? await this.prisma.emailSendLog.findUnique({
          where: { resendEmailId },
        })
      : null;

    let churchId: string | undefined = sendLog?.churchId ?? undefined;
    const personId: string | undefined = sendLog?.personId ?? undefined;
    const userId: string | undefined = sendLog?.userId ?? undefined;
    const emailType: string | undefined = sendLog?.emailType ?? undefined;
    const registrationId: string | undefined =
      sendLog?.registrationId ?? undefined;
    const broadcastContent = sendLog?.broadcastContent ?? undefined;

    // Determine EmailDeliveryStatus enum mapping
    let newStatus: EmailDeliveryStatus = EmailDeliveryStatus.BOUNCED;
    if (type === 'email.failed' || type === 'email.suppressed')
      newStatus = EmailDeliveryStatus.DROPPED;
    if (type === 'email.complained') newStatus = EmailDeliveryStatus.COMPLAINED;

    let recipientType: string | null = null;
    let recipientId: string | null = null;
    let recipientName = 'Unknown Recipient';

    // 1. Check Person model
    let targetPerson = null;
    if (personId) {
      targetPerson = await this.prisma.person.findUnique({
        where: { id: personId },
      });
    }
    if (!targetPerson) {
      targetPerson = await this.prisma.person.findFirst({
        where: { email: { equals: bouncedEmail } },
      });
    }

    if (targetPerson) {
      recipientType = 'PERSON';
      recipientId = targetPerson.id;
      recipientName =
        `${targetPerson.firstName} ${targetPerson.lastName}`.trim();
      churchId = churchId || targetPerson.churchId;

      await this.prisma.person.update({
        where: { id: targetPerson.id },
        data: {
          emailStatus: newStatus,
          emailBounceReason: reason,
          emailBouncedAt: new Date(),
        },
      });
      this.logger.warn(
        `Updated Person ${targetPerson.id} emailStatus to ${newStatus}`,
      );
    }

    // 2. Check User model
    let targetUser = null;
    if (userId) {
      targetUser = await this.prisma.user.findUnique({ where: { id: userId } });
    }
    if (!targetUser) {
      targetUser = await this.prisma.user.findFirst({
        where: { email: { equals: bouncedEmail } },
      });
    }

    if (targetUser) {
      if (!recipientType) {
        recipientType = 'USER';
        recipientId = targetUser.id;
        recipientName = `${targetUser.firstName} ${targetUser.lastName}`.trim();
        churchId = churchId || targetUser.churchId;
      }

      await this.prisma.user.update({
        where: { id: targetUser.id },
        data: {
          emailStatus: newStatus,
          emailBounceReason: reason,
          emailBouncedAt: new Date(),
        },
      });
      this.logger.warn(
        `Updated User ${targetUser.id} emailStatus to ${newStatus}`,
      );
    }

    // 3. Save record to EmailBounce table
    const bounceLog = await this.prisma.emailBounce.create({
      data: {
        churchId,
        email: bouncedEmail,
        resendEmailId,
        eventType: type,
        bounceType,
        reason,
        recipientType,
        recipientId,
        emailType,
        registrationId,
        broadcastContent,
        isResolved: false,
      },
    });

    // 4. Send alert email to Church Super Admins
    if (churchId) {
      const churchAdmins = await this.prisma.user.findMany({
        where: {
          churchId,
          isActive: true,
          emailStatus: 'DELIVERABLE',
          userRoles: {
            some: {
              role: {
                name: 'SUPER_ADMIN',
              },
            },
          },
        },
        select: { email: true, firstName: true },
      });

      const church = await this.prisma.church.findUnique({
        where: { id: churchId },
        select: { name: true },
      });
      const churchName = church?.name || 'Dove Platform';

      for (const admin of churchAdmins) {
        await this.emailService.sendBounceAdminAlert({
          recipientEmail: admin.email,
          bouncedEmail,
          eventType: type,
          reason,
          recipientName,
          recipientType: recipientType || 'Unknown',
          churchName,
        });
      }
    } else {
      this.logger.warn(
        `Bounce event ${bounceLog.id} for ${bouncedEmail} could not be linked to a church (no matching Person/User and no EmailSendLog record) — admin alert not sent.`,
      );
    }

    return {
      success: true,
      message: `Processed bounce event ${bounceLog.id} for ${bouncedEmail}`,
    };
  }
}
