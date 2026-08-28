import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RemediateEmailBounceDto } from '../dto/remediate-email-bounce.dto';
import {
  EMAIL_SERVICE,
  type IEmailService,
} from '../interfaces/email-service.interface';

@ApiTags('Email Bounces')
@ApiBearerAuth()
@Controller('email-bounces')
export class EmailBounceController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
  ) {}

  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ResponseMessage('Active email bounce alerts retrieved successfully')
  @ApiOperation({ summary: 'Get list of active (unresolved) email bounces' })
  @ApiResponse({ status: 200, description: 'List of unresolved email bounces' })
  async getUnresolvedBounces(@CurrentUser('churchId') churchId: string) {
    return this.prisma.emailBounce.findMany({
      where: {
        churchId,
        isResolved: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch(':id/resolve')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email bounce alert marked as resolved')
  @ApiOperation({ summary: 'Mark an email bounce alert as resolved' })
  @ApiResponse({ status: 200, description: 'Bounce resolved' })
  @ApiResponse({ status: 404, description: 'Bounce record not found' })
  async resolveBounce(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    const bounce = await this.prisma.emailBounce.findFirst({
      where: { id, churchId },
    });

    if (!bounce) {
      throw new NotFoundException(
        `Email bounce record with ID ${id} not found`,
      );
    }

    return this.prisma.emailBounce.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: userId,
      },
    });
  }

  @Post(':id/remediate')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Email address corrected and bounce alert resolved')
  @ApiOperation({
    summary:
      'Correct bounced email address, reset status, and optionally resend email',
  })
  @ApiResponse({
    status: 200,
    description: 'Email address updated and bounce resolved',
  })
  @ApiResponse({ status: 404, description: 'Bounce record not found' })
  async remediateBounce(
    @Param('id') id: string,
    @Body() dto: RemediateEmailBounceDto,
    @CurrentUser('sub') adminUserId: string,
    @CurrentUser('churchId') churchId: string,
  ) {
    const bounce = await this.prisma.emailBounce.findFirst({
      where: { id, churchId },
    });

    if (!bounce) {
      throw new NotFoundException(
        `Email bounce record with ID ${id} not found`,
      );
    }

    const { newEmail, resendOriginal, subject } = dto;
    const oldEmail = bounce.email;

    // 1. Update Person if matching recipientId or old email
    if (bounce.recipientType === 'PERSON' && bounce.recipientId) {
      await this.prisma.person.update({
        where: { id: bounce.recipientId },
        data: {
          email: newEmail,
          emailStatus: 'DELIVERABLE',
          emailBounceReason: null,
          emailBouncedAt: null,
        },
      });
    } else {
      const matchingPeople = await this.prisma.person.findMany({
        where: { churchId, email: oldEmail },
      });
      for (const p of matchingPeople) {
        await this.prisma.person.update({
          where: { id: p.id },
          data: {
            email: newEmail,
            emailStatus: 'DELIVERABLE',
            emailBounceReason: null,
            emailBouncedAt: null,
          },
        });
      }
    }

    // 2. Update User if matching recipientId or old email
    if (bounce.recipientType === 'USER' && bounce.recipientId) {
      await this.prisma.user.update({
        where: { id: bounce.recipientId },
        data: {
          email: newEmail,
          emailStatus: 'DELIVERABLE',
          emailBounceReason: null,
          emailBouncedAt: null,
        },
      });
    } else {
      const matchingUsers = await this.prisma.user.findMany({
        where: { churchId, email: oldEmail },
      });
      for (const u of matchingUsers) {
        await this.prisma.user.update({
          where: { id: u.id },
          data: {
            email: newEmail,
            emailStatus: 'DELIVERABLE',
            emailBounceReason: null,
            emailBouncedAt: null,
          },
        });
      }
    }

    // 3. Mark bounce record as resolved
    const updatedBounce = await this.prisma.emailBounce.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: adminUserId,
      },
    });

    // 4. Optionally trigger a custom email resend
    if (resendOriginal) {
      const church = await this.prisma.church.findUnique({
        where: { id: churchId },
      });
      await this.emailService.sendCustomBroadcast({
        recipientEmail: newEmail,
        recipientName: 'Valued Member',
        subject: subject || 'Update & Notification',
        message: 'Your email address has been updated in our system.',
        churchName: church?.name || 'Dove Platform',
        churchId,
      });
    }

    return {
      success: true,
      message: `Successfully remediated email ${oldEmail} -> ${newEmail}`,
      bounce: updatedBounce,
    };
  }
}
