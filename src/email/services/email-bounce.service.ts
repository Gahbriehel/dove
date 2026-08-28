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

    // Only process delivery issue events
    if (
      !['email.bounced', 'email.dropped', 'email.complained'].includes(type)
    ) {
      return { success: true, message: `Ignored event type: ${type}` };
    }

    const recipients = data.to || [];
    if (recipients.length === 0) {
      return { success: false, message: 'No recipient email found in payload' };
    }

    const bouncedEmail = recipients[0].toLowerCase().trim();
    const resendEmailId = data.email_id;
    const bounceType = data.bounce?.type || 'Hard';
    const reason = data.bounce?.message || `Event: ${type}`;

    // Extract headers/tags for entity identification if available
    let churchId: string | undefined = undefined;
    let personId: string | undefined = undefined;
    let userId: string | undefined = undefined;

    if (data.headers && Array.isArray(data.headers)) {
      for (const h of data.headers) {
        if (h.name === 'X-Dove-Church-Id') churchId = h.value;
        if (h.name === 'X-Dove-Person-Id') personId = h.value;
        if (h.name === 'X-Dove-User-Id') userId = h.value;
      }
    }

    // Determine EmailDeliveryStatus enum mapping
    let newStatus: EmailDeliveryStatus = EmailDeliveryStatus.BOUNCED;
    if (type === 'email.dropped') newStatus = EmailDeliveryStatus.DROPPED;
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
        isResolved: false,
      },
    });

    // 4. Send alert email to Church Super Admins / Admins
    if (churchId) {
      const churchAdmins = await this.prisma.user.findMany({
        where: {
          churchId,
          isActive: true,
          emailStatus: 'DELIVERABLE',
          userRoles: {
            some: {
              role: {
                name: { in: ['SUPER_ADMIN', 'ADMIN'] },
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
    }

    return {
      success: true,
      message: `Processed bounce event ${bounceLog.id} for ${bouncedEmail}`,
    };
  }
}
