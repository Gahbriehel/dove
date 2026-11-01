import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CheckInStatus,
  FollowUpStatus,
  MembershipStatus,
  MessageChannel,
  OutreachPurpose,
  OutreachStatus,
  Prisma,
} from '@prisma/client';
import { resolveBirthdayTargetYear } from '../common/utils/birthday-year.util';
import { lagosDay, toLagosClock } from '../common/utils/lagos-time.util';
import { normalizePhone, toWhatsAppDigits } from '../common/utils/phone.util';
import {
  resolveAdminName,
  resolveChurchLabel,
  TemplateRenderer,
} from '../message-templates/template-renderer';
import {
  candidateTemplates,
  pickTemplate,
} from '../message-templates/template-selection';
import { PrismaService } from '../prisma/prisma.service';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { ConfirmOutreachDto } from './dto/confirm-outreach.dto';
import { CreateOutreachDto } from './dto/create-outreach.dto';
import { PreviewOutreachDto } from './dto/preview-outreach.dto';
import { QueryOutreachDto } from './dto/query-outreach.dto';
import { QueryTodayDto } from './dto/query-today.dto';
import {
  OutreachWarning,
  OutreachWarningCode,
  RECENT_CONTACT_DAYS,
  TODAY_DEFAULT_LIMIT,
  UNCONFIRMED_AFTER_MINUTES,
  VISITOR_FOLLOW_UP_COOLDOWN_DAYS,
  VISITOR_FOLLOW_UP_MIN_AGE_DAYS,
} from './outreach.constants';

const DAY_MS = 24 * 60 * 60 * 1000;

const SENDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
} satisfies Prisma.UserSelect;

interface PreparedMessage {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    whatsappOptOut: boolean;
    dateOfBirth: Date | null;
  };
  toPhone: string | null;
  warnings: OutreachWarningCode[];
  checkInId: string | null;
  /** Birthday year this message would be recorded against (BIRTHDAY only). */
  birthdayYear: number | null;
}

@Injectable()
export class OutreachService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(dto: PreviewOutreachDto, user: ActiveUserData) {
    const churchId = await this.resolveChurchId(user);
    const prepared = await this.prepare(dto, churchId);
    const { person, toPhone, warnings } = prepared;

    const [church, sender, lastOutreach] = await Promise.all([
      this.prisma.church.findUniqueOrThrow({ where: { id: churchId } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } }),
      this.prisma.outreachMessage.findFirst({
        where: {
          personId: person.id,
          churchId,
          status: { not: OutreachStatus.NOT_SENT },
        },
        orderBy: { openedAt: 'desc' },
        include: { sentBy: { select: SENDER_SELECT } },
      }),
    ]);

    const { template, alternatives } = await this.chooseTemplate(
      dto,
      churchId,
      person.id,
    );
    if (!template) warnings.push(OutreachWarning.NO_TEMPLATE);

    const body = template
      ? TemplateRenderer.render(template.body, {
          firstName: person.firstName,
          adminName: resolveAdminName(sender),
          churchName: resolveChurchLabel(church),
        })
      : null;

    return {
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
      },
      toPhone,
      whatsappDigits: toPhone ? toWhatsAppDigits(toPhone) : null,
      template: template ? { id: template.id, name: template.name } : null,
      alternatives: alternatives.map((t) => ({ id: t.id, name: t.name })),
      body,
      lastOutreach: lastOutreach
        ? {
            at: lastOutreach.openedAt,
            by: resolveAdminName(lastOutreach.sentBy),
            purpose: lastOutreach.purpose,
          }
        : null,
      warnings,
    };
  }

  async open(dto: CreateOutreachDto, user: ActiveUserData) {
    const churchId = await this.resolveChurchId(user);
    const prepared = await this.prepare(dto, churchId);
    const { person, toPhone } = prepared;

    if (person.whatsappOptOut) {
      throw new ConflictException({
        message: `${person.firstName} has asked not to be contacted on WhatsApp`,
        code: OutreachWarning.WHATSAPP_OPT_OUT,
      });
    }
    if (!toPhone) {
      throw new ConflictException({
        message: `${person.firstName} does not have a valid phone number`,
        code: person.phone
          ? OutreachWarning.INVALID_PHONE
          : OutreachWarning.NO_PHONE,
      });
    }

    let templateId: string | null = null;
    if (dto.templateId) {
      const template = await this.prisma.messageTemplate.findFirst({
        where: { id: dto.templateId, churchId },
        select: { id: true },
      });
      if (!template) {
        throw new BadRequestException({
          message: 'Message template not found in this church',
          code: 'TEMPLATE_NOT_FOUND',
        });
      }
      templateId = template.id;
    }

    return this.prisma.outreachMessage.create({
      data: {
        churchId,
        personId: person.id,
        sentByUserId: user.sub,
        channel: MessageChannel.WHATSAPP,
        purpose: dto.purpose,
        checkInId: prepared.checkInId,
        birthdayYear: prepared.birthdayYear,
        templateId,
        toPhone,
        body: dto.body,
      },
    });
  }

  async confirm(id: string, dto: ConfirmOutreachDto, user: ActiveUserData) {
    const churchId = await this.resolveChurchId(user);
    const outreach = await this.prisma.outreachMessage.findFirst({
      where: { id, churchId },
    });
    if (!outreach) {
      throw new NotFoundException(`Outreach message "${id}" not found`);
    }

    const isPrivileged = user.roles?.some((r) =>
      ['ADMIN', 'SUPER_ADMIN'].includes(r),
    );
    if (outreach.sentByUserId !== user.sub && !isPrivileged) {
      throw new ForbiddenException(
        'Only the person who opened this message or an admin can confirm it',
      );
    }

    if (outreach.status === OutreachStatus.CONFIRMED_SENT) {
      if (!dto.sent) {
        throw new ConflictException(
          'This message has already been confirmed as sent',
        );
      }
      return outreach;
    }

    if (!dto.sent) {
      if (outreach.status === OutreachStatus.NOT_SENT) return outreach;
      return this.prisma.outreachMessage.update({
        where: { id },
        data: { status: OutreachStatus.NOT_SENT },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      // Guards against two confirmations racing: only one applies side effects.
      const claimed = await tx.outreachMessage.updateMany({
        where: { id, status: { not: OutreachStatus.CONFIRMED_SENT } },
        data: { status: OutreachStatus.CONFIRMED_SENT, confirmedAt: now },
      });
      if (claimed.count === 0) {
        return tx.outreachMessage.findUniqueOrThrow({ where: { id } });
      }

      await tx.person.update({
        where: { id: outreach.personId },
        data: { lastFollowUpAt: now },
      });

      if (outreach.purpose === OutreachPurpose.VISITOR_FOLLOW_UP) {
        await tx.person.updateMany({
          where: {
            id: outreach.personId,
            followUpStatus: FollowUpStatus.PENDING,
          },
          data: { followUpStatus: FollowUpStatus.IN_PROGRESS },
        });
      }

      if (
        outreach.purpose === OutreachPurpose.BIRTHDAY &&
        outreach.birthdayYear !== null
      ) {
        await tx.birthdayGreeting.upsert({
          where: {
            unique_person_year_channel_greeting: {
              personId: outreach.personId,
              year: outreach.birthdayYear,
              channel: MessageChannel.WHATSAPP,
            },
          },
          update: {},
          create: {
            churchId: outreach.churchId,
            personId: outreach.personId,
            sentByUserId: outreach.sentByUserId,
            year: outreach.birthdayYear,
            channel: MessageChannel.WHATSAPP,
            message: outreach.body,
          },
        });
      }

      return tx.outreachMessage.findUniqueOrThrow({ where: { id } });
    });
  }

  async findAll(query: QueryOutreachDto, user: ActiveUserData) {
    const churchId = await this.resolveChurchId(user);
    const { personId, purpose, status, sentByUserId, from, to } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.OutreachMessageWhereInput = {
      churchId,
      ...(personId && { personId }),
      ...(purpose && { purpose }),
      ...(status && { status }),
      ...(sentByUserId && { sentByUserId }),
      ...((from || to) && {
        openedAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.outreachMessage.findMany({
        where,
        orderBy: { openedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          person: { select: { id: true, firstName: true, lastName: true } },
          sentBy: { select: SENDER_SELECT },
        },
      }),
      this.prisma.outreachMessage.count({ where }),
    ]);

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Today's outreach to-do list, computed on request in Lagos time. */
  async today(query: QueryTodayDto, user: ActiveUserData) {
    const churchId = await this.resolveChurchId(user);
    const limit = query.limit ?? TODAY_DEFAULT_LIMIT;
    const now = new Date();
    const day = lagosDay(now);

    const [birthdays, checkIns, visitorFollowUps, unconfirmed] =
      await Promise.all([
        this.todaysBirthdays(churchId, day, limit),
        this.dueCheckIns(churchId, user.sub, day.end, limit),
        this.visitorsToFollowUp(churchId, now, limit),
        this.unconfirmedOutreach(churchId, user.sub, now, limit),
      ]);

    return { birthdays, checkIns, visitorFollowUps, unconfirmed };
  }

  private async todaysBirthdays(
    churchId: string,
    day: ReturnType<typeof lagosDay>,
    limit: number,
  ) {
    const people = await this.prisma.person.findMany({
      where: { churchId, dateOfBirth: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappOptOut: true,
        dateOfBirth: true,
      },
    });

    const celebrating = people.filter(
      (p) =>
        p.dateOfBirth!.getUTCMonth() + 1 === day.month &&
        p.dateOfBirth!.getUTCDate() === day.day,
    );
    if (celebrating.length === 0) return { items: [], total: 0 };

    const greetings = await this.prisma.birthdayGreeting.findMany({
      where: {
        churchId,
        year: day.year,
        personId: { in: celebrating.map((p) => p.id) },
      },
      select: { personId: true, channel: true },
    });
    const whatsappGreeted = new Set(
      greetings
        .filter((g) => g.channel === MessageChannel.WHATSAPP)
        .map((g) => g.personId),
    );
    const emailGreeted = new Set(
      greetings
        .filter((g) => g.channel === MessageChannel.EMAIL)
        .map((g) => g.personId),
    );

    const pending = celebrating.filter((p) => !whatsappGreeted.has(p.id));
    return {
      total: pending.length,
      items: pending.slice(0, limit).map((p) => ({
        personId: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: p.phone,
        whatsappOptOut: p.whatsappOptOut,
        turningAge: day.year - p.dateOfBirth!.getUTCFullYear(),
        emailGreeted: emailGreeted.has(p.id),
      })),
    };
  }

  private async dueCheckIns(
    churchId: string,
    userId: string,
    endOfToday: Date,
    limit: number,
  ) {
    const base: Prisma.PastoralCheckInWhereInput = {
      churchId,
      status: CheckInStatus.SCHEDULED,
      scheduledFor: { lte: endOfToday },
    };
    const include = {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          whatsappOptOut: true,
        },
      },
    } satisfies Prisma.PastoralCheckInInclude;
    const orderBy = { scheduledFor: 'asc' } as const;

    const [total, mine] = await Promise.all([
      this.prisma.pastoralCheckIn.count({ where: base }),
      this.prisma.pastoralCheckIn.findMany({
        where: { ...base, assignedToId: userId },
        orderBy,
        take: limit,
        include,
      }),
    ]);

    const others =
      mine.length < limit
        ? await this.prisma.pastoralCheckIn.findMany({
            where: {
              ...base,
              OR: [{ assignedToId: null }, { assignedToId: { not: userId } }],
            },
            orderBy,
            take: limit - mine.length,
            include,
          })
        : [];

    return { total, items: [...mine, ...others] };
  }

  private async visitorsToFollowUp(churchId: string, now: Date, limit: number) {
    const where: Prisma.PersonWhereInput = {
      churchId,
      membershipStatus: MembershipStatus.VISITOR,
      followUpStatus: FollowUpStatus.PENDING,
      createdAt: {
        lte: new Date(now.getTime() - VISITOR_FOLLOW_UP_MIN_AGE_DAYS * DAY_MS),
      },
      outreachMessages: {
        none: {
          status: OutreachStatus.CONFIRMED_SENT,
          confirmedAt: {
            gte: new Date(
              now.getTime() - VISITOR_FOLLOW_UP_COOLDOWN_DAYS * DAY_MS,
            ),
          },
        },
      },
    };

    const [total, items] = await Promise.all([
      this.prisma.person.count({ where }),
      this.prisma.person.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          whatsappOptOut: true,
          createdAt: true,
        },
      }),
    ]);
    return { total, items };
  }

  private async unconfirmedOutreach(
    churchId: string,
    userId: string,
    now: Date,
    limit: number,
  ) {
    const where: Prisma.OutreachMessageWhereInput = {
      churchId,
      sentByUserId: userId,
      status: OutreachStatus.OPENED,
      openedAt: {
        lt: new Date(now.getTime() - UNCONFIRMED_AFTER_MINUTES * 60 * 1000),
      },
    };

    const [total, items] = await Promise.all([
      this.prisma.outreachMessage.count({ where }),
      this.prisma.outreachMessage.findMany({
        where,
        orderBy: { openedAt: 'asc' },
        take: limit,
        include: {
          person: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);
    return { total, items };
  }

  /**
   * Validates the person and check-in and works out the number, warnings and
   * birthday year shared by preview and open.
   */
  private async prepare(
    dto: PreviewOutreachDto,
    churchId: string,
  ): Promise<PreparedMessage> {
    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, churchId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        whatsappOptOut: true,
        dateOfBirth: true,
      },
    });
    if (!person) {
      throw new BadRequestException({
        message: 'Person not found in this church',
        code: 'PERSON_NOT_IN_CHURCH',
      });
    }

    let checkInId: string | null = null;
    if (dto.checkInId) {
      const checkIn = await this.prisma.pastoralCheckIn.findFirst({
        where: { id: dto.checkInId, personId: person.id, churchId },
        select: { id: true },
      });
      if (!checkIn) {
        throw new BadRequestException({
          message: 'Check-in does not belong to this person',
          code: 'CHECK_IN_PERSON_MISMATCH',
        });
      }
      checkInId = checkIn.id;
    }

    const warnings: OutreachWarningCode[] = [];
    const toPhone = person.phone ? normalizePhone(person.phone) : null;
    if (!person.phone) warnings.push(OutreachWarning.NO_PHONE);
    else if (!toPhone) warnings.push(OutreachWarning.INVALID_PHONE);
    if (person.whatsappOptOut) warnings.push(OutreachWarning.WHATSAPP_OPT_OUT);

    let birthdayYear: number | null = null;
    if (dto.purpose === OutreachPurpose.BIRTHDAY) {
      const clock = toLagosClock();
      birthdayYear = person.dateOfBirth
        ? await resolveBirthdayTargetYear(
            person.dateOfBirth,
            async (year) =>
              (await this.prisma.birthdayGreeting.count({
                where: {
                  personId: person.id,
                  year,
                  channel: MessageChannel.WHATSAPP,
                },
              })) > 0,
            clock,
          )
        : clock.getUTCFullYear();

      const alreadyGreeted = await this.prisma.birthdayGreeting.count({
        where: {
          personId: person.id,
          year: birthdayYear,
          channel: MessageChannel.WHATSAPP,
        },
      });
      if (alreadyGreeted > 0) {
        warnings.push(OutreachWarning.ALREADY_GREETED_THIS_YEAR);
      }
    }

    const recent = await this.prisma.outreachMessage.count({
      where: {
        personId: person.id,
        status: OutreachStatus.CONFIRMED_SENT,
        confirmedAt: {
          gte: new Date(Date.now() - RECENT_CONTACT_DAYS * DAY_MS),
        },
      },
    });
    if (recent > 0) warnings.push(OutreachWarning.CONTACTED_RECENTLY);

    return { person, toPhone, warnings, checkInId, birthdayYear };
  }

  private async chooseTemplate(
    dto: PreviewOutreachDto,
    churchId: string,
    personId: string,
  ) {
    if (dto.templateId) {
      const forced = await this.prisma.messageTemplate.findFirst({
        where: { id: dto.templateId, churchId, isActive: true },
      });
      if (!forced) {
        throw new BadRequestException({
          message: 'Message template not found in this church',
          code: 'TEMPLATE_NOT_FOUND',
        });
      }
      return { template: forced, alternatives: [] };
    }

    const [templates, checkIn, lastUsed] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where: {
          churchId,
          channel: MessageChannel.WHATSAPP,
          purpose: dto.purpose,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      }),
      dto.checkInId
        ? this.prisma.pastoralCheckIn.findUnique({
            where: { id: dto.checkInId },
            select: { reason: true },
          })
        : null,
      this.prisma.outreachMessage.findFirst({
        where: {
          personId,
          purpose: dto.purpose,
          templateId: { not: null },
        },
        orderBy: { openedAt: 'desc' },
        select: { templateId: true },
      }),
    ]);

    const candidates = candidateTemplates(templates, checkIn?.reason);
    const template = pickTemplate(candidates, lastUsed?.templateId);
    return {
      template,
      alternatives: candidates.filter((t) => t.id !== template?.id),
    };
  }

  private async resolveChurchId(user: ActiveUserData): Promise<string> {
    return user.churchId || (await this.prisma.getDefaultChurchId());
  }
}
