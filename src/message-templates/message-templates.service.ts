import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OutreachPurpose, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageTemplateDto } from './dto/create-message-template.dto';
import { QueryMessageTemplateDto } from './dto/query-message-template.dto';
import { UpdateMessageTemplateDto } from './dto/update-message-template.dto';
import {
  resolveAdminName,
  resolveChurchLabel,
  TemplateRenderer,
} from './template-renderer';

@Injectable()
export class MessageTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryMessageTemplateDto, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const { channel, purpose, checkInReason, includeInactive } = query;

    return this.prisma.messageTemplate.findMany({
      where: {
        churchId,
        ...(channel && { channel }),
        ...(purpose && { purpose }),
        ...(checkInReason && { checkInReason }),
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: [{ purpose: 'asc' }, { checkInReason: 'asc' }, { name: 'asc' }],
    });
  }

  async create(
    dto: CreateMessageTemplateDto,
    userId: string,
    userChurchId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    this.assertValid(dto.purpose, dto.checkInReason, dto.body);

    return this.prisma.messageTemplate.create({
      data: {
        churchId,
        channel: dto.channel,
        purpose: dto.purpose,
        checkInReason: dto.checkInReason ?? null,
        name: dto.name.trim(),
        body: dto.body,
        isActive: dto.isActive,
        createdById: userId,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateMessageTemplateDto,
    userChurchId?: string,
  ) {
    const existing = await this.findOne(id, userChurchId);

    const purpose = dto.purpose ?? existing.purpose;
    // An existing reason is dropped when the purpose changes away from check-ins.
    const checkInReason =
      dto.checkInReason !== undefined
        ? dto.checkInReason
        : purpose === OutreachPurpose.PASTORAL_CHECK_IN
          ? existing.checkInReason
          : null;
    this.assertValid(purpose, checkInReason, dto.body ?? existing.body);

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.channel !== undefined && { channel: dto.channel }),
        ...(dto.purpose !== undefined && { purpose: dto.purpose }),
        checkInReason: checkInReason ?? null,
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.body !== undefined && { body: dto.body }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /** Soft-deletes templates already used in outreach; removes the rest. */
  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    const used = await this.prisma.outreachMessage.count({
      where: { templateId: id },
    });

    if (used > 0) {
      await this.prisma.messageTemplate.update({
        where: { id },
        data: { isActive: false },
      });
      return { id, deleted: false, deactivated: true };
    }

    await this.prisma.messageTemplate.delete({ where: { id } });
    return { id, deleted: true, deactivated: false };
  }

  async preview(body: string, userId: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const [church, user] = await Promise.all([
      this.prisma.church.findUnique({ where: { id: churchId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    const unknown = TemplateRenderer.findUnknownPlaceholders(body);

    return {
      body: TemplateRenderer.render(body, {
        firstName: 'Sarah',
        adminName: user ? resolveAdminName(user) : 'Pastor John',
        churchName: church ? resolveChurchLabel(church) : 'Your Church',
      }),
      unknownPlaceholders: unknown,
    };
  }

  private async findOne(id: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, churchId },
    });
    if (!template) {
      throw new NotFoundException(`Message template "${id}" not found`);
    }
    return template;
  }

  private assertValid(
    purpose: OutreachPurpose,
    checkInReason: Prisma.MessageTemplateCreateInput['checkInReason'],
    body: string,
  ) {
    if (checkInReason && purpose !== OutreachPurpose.PASTORAL_CHECK_IN) {
      throw new BadRequestException(
        'checkInReason can only be set when purpose is PASTORAL_CHECK_IN',
      );
    }

    const unknown = TemplateRenderer.findUnknownPlaceholders(body);
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown placeholder${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Allowed: {{firstName}}, {{adminName}}, {{churchName}}`,
      );
    }
  }
}
