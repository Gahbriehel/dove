import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CheckInStatus,
  FollowUpStatus,
  Gender,
  MembershipStatus,
  MessageChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CSV_EXPORT_MAX_ROWS } from '../common/utils/csv.util';
import { normalizePhoneOrThrow } from '../common/utils/phone.util';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';
import { PromotePersonDto } from './dto/promote-person.dto';
import { QueryPersonMessagesDto } from './dto/query-person-messages.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MESSAGE_PREVIEW_LENGTH = 140;

const SENDER_SELECT = {
  id: true,
  firstName: true,
  displayName: true,
} satisfies Prisma.UserSelect;

export interface PersonMessageEntry {
  type: MessageChannel;
  purpose: string;
  at: Date;
  by: { id: string; name: string } | null;
  status: string;
  preview: string;
  refId: string;
}

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto, userChurchId?: string) {
    const { dateOfBirth, lastFollowUpAt, phone, ...rest } = createPersonDto;

    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    const membershipStatus =
      createPersonDto.membershipStatus ?? MembershipStatus.VISITOR;

    const followUpStatus =
      createPersonDto.followUpStatus !== undefined
        ? createPersonDto.followUpStatus
        : membershipStatus === MembershipStatus.VISITOR
          ? FollowUpStatus.PENDING
          : null;

    return this.prisma.person.create({
      data: {
        ...rest,
        ...(phone !== undefined && { phone: normalizePhoneOrThrow(phone) }),
        churchId,
        membershipStatus,
        followUpStatus,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        ...(lastFollowUpAt !== undefined && {
          lastFollowUpAt: lastFollowUpAt ? new Date(lastFollowUpAt) : null,
        }),
      },
    });
  }

  private buildWhere(
    query: QueryPersonDto,
    targetChurchId: string,
  ): Prisma.PersonWhereInput {
    const {
      membershipStatus,
      gender,
      search,
      departmentId,
      followUpStatus,
      hasPendingCheckIn,
    } = query;

    const where: Prisma.PersonWhereInput = {
      churchId: targetChurchId,
    };

    if (membershipStatus) {
      where.membershipStatus = membershipStatus;
    }

    if (gender) {
      where.gender = gender;
    }

    if (departmentId) {
      where.departmentMemberships = {
        some: {
          departmentId,
        },
      };
    }

    if (followUpStatus) {
      where.followUpStatus = followUpStatus as FollowUpStatus;
    }

    if (hasPendingCheckIn === true) {
      where.pastoralCheckIns = {
        some: {
          status: CheckInStatus.SCHEDULED,
        },
      };
    } else if (hasPendingCheckIn === false) {
      where.pastoralCheckIns = {
        none: {
          status: CheckInStatus.SCHEDULED,
        },
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    return where;
  }

  async findAll(query: QueryPersonDto, userChurchId?: string) {
    const { churchId: queryChurchId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const targetChurchId =
      queryChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, targetChurchId);

    const [
      items,
      total,
      visitorsCount,
      membersCount,
      workersCount,
      leadersCount,
      pastorsCount,
      maleCount,
      femaleCount,
      otherGenderCount,
      unspecifiedGenderCount,
    ] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          church: {
            select: { id: true, name: true, slug: true },
          },
          departmentMemberships: {
            include: {
              department: {
                select: { id: true, name: true, description: true },
              },
            },
          },
          pastoralCheckIns: {
            select: {
              id: true,
              status: true,
              completedAt: true,
              scheduledFor: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          registrations: {
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  startDate: true,
                  status: true,
                  location: true,
                },
              },
              team: {
                select: { id: true, name: true, color: true },
              },
              attendance: {
                select: { id: true, checkedInAt: true, checkedInBy: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: { registrations: true },
          },
        },
      }),
      this.prisma.person.count({ where }),
      this.prisma.person.count({
        where: {
          churchId: targetChurchId,
          membershipStatus: MembershipStatus.VISITOR,
        },
      }),
      this.prisma.person.count({
        where: {
          churchId: targetChurchId,
          membershipStatus: MembershipStatus.MEMBER,
        },
      }),
      this.prisma.person.count({
        where: {
          churchId: targetChurchId,
          membershipStatus: MembershipStatus.WORKER,
        },
      }),
      this.prisma.person.count({
        where: {
          churchId: targetChurchId,
          membershipStatus: MembershipStatus.LEADER,
        },
      }),
      this.prisma.person.count({
        where: {
          churchId: targetChurchId,
          membershipStatus: MembershipStatus.PASTOR,
        },
      }),
      this.prisma.person.count({
        where: { churchId: targetChurchId, gender: Gender.MALE },
      }),
      this.prisma.person.count({
        where: { churchId: targetChurchId, gender: Gender.FEMALE },
      }),
      this.prisma.person.count({
        where: { churchId: targetChurchId, gender: Gender.OTHER },
      }),
      this.prisma.person.count({
        where: { churchId: targetChurchId, gender: null },
      }),
    ]);

    const formattedItems = items.map((person) => {
      const eventsRegisteredCount = person.registrations.length;
      const eventsAttendedCount = person.registrations.filter(
        (reg) => reg.attendance !== null,
      ).length;

      const departments =
        person.departmentMemberships?.map((dm) => ({
          id: dm.department.id,
          name: dm.department.name,
          description: dm.department.description,
          role: dm.role,
          joinedAt: dm.joinedAt,
        })) || [];

      const completedCheckIns = (person.pastoralCheckIns ?? []).filter(
        (c) => c.status === CheckInStatus.COMPLETED && c.completedAt !== null,
      );
      const lastCheckInAt =
        completedCheckIns.length > 0 ? completedCheckIns[0].completedAt : null;
      const hasPendingCheckIn = (person.pastoralCheckIns ?? []).some(
        (c) => c.status === CheckInStatus.SCHEDULED,
      );

      return {
        ...person,
        eventsRegisteredCount,
        eventsAttendedCount,
        departments,
        lastCheckInAt,
        hasPendingCheckIn,
      };
    });

    return {
      items: formattedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total:
          visitorsCount +
          membersCount +
          workersCount +
          leadersCount +
          pastorsCount,
        membership: {
          visitors: visitorsCount,
          members: membersCount,
          workers: workersCount,
          leaders: leadersCount,
          pastors: pastorsCount,
        },
        gender: {
          male: maleCount,
          female: femaleCount,
          other: otherGenderCount,
          unspecified: unspecifiedGenderCount,
        },
      },
    };
  }

  async exportAll(query: QueryPersonDto, userChurchId?: string) {
    const targetChurchId =
      query.churchId ||
      userChurchId ||
      (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, targetChurchId);

    const people = await this.prisma.person.findMany({
      where,
      take: CSV_EXPORT_MAX_ROWS,
      orderBy: { createdAt: 'desc' },
      include: {
        registrations: {
          select: { attendance: { select: { id: true } } },
        },
      },
    });

    return people.map((person) => ({
      ...person,
      eventsRegisteredCount: person.registrations.length,
      eventsAttendedCount: person.registrations.filter(
        (reg) => reg.attendance !== null,
      ).length,
    }));
  }

  async findOne(id: string, userChurchId?: string) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id, churchId: targetChurchId },
      include: {
        church: {
          select: { id: true, name: true, slug: true },
        },
        departmentMemberships: {
          include: {
            department: {
              select: { id: true, name: true, description: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        registrations: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                startDate: true,
                status: true,
                location: true,
              },
            },
            team: {
              select: { id: true, name: true, color: true },
            },
            attendance: {
              select: { id: true, checkedInAt: true, checkedInBy: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        pastoralCheckIns: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${id}" not found`);
    }

    const registrations = person.registrations ?? [];
    const eventsRegisteredCount = registrations.length;
    const eventsAttendedCount = registrations.filter(
      (reg) => reg.attendance !== null,
    ).length;

    const departments =
      person.departmentMemberships?.map((dm) => ({
        id: dm.department.id,
        name: dm.department.name,
        description: dm.department.description,
        role: dm.role,
        joinedAt: dm.joinedAt,
      })) || [];

    return {
      ...person,
      eventsRegisteredCount,
      eventsAttendedCount,
      departments,
      pastoralCheckIns: person.pastoralCheckIns ?? [],
    };
  }

  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
    userChurchId?: string,
  ) {
    const existing = await this.findOne(id, userChurchId);

    const {
      dateOfBirth,
      lastFollowUpAt,
      emailOptOut,
      whatsappOptOut,
      phone,
      ...rest
    } = updatePersonDto;

    const data: Prisma.PersonUpdateInput = { ...rest };

    if (phone !== undefined) {
      data.phone = normalizePhoneOrThrow(phone);
    }

    if (dateOfBirth !== undefined) {
      data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (lastFollowUpAt !== undefined) {
      data.lastFollowUpAt = lastFollowUpAt ? new Date(lastFollowUpAt) : null;
    }

    if (emailOptOut !== undefined && emailOptOut !== existing.emailOptOut) {
      data.emailOptOut = emailOptOut;
      data.emailOptOutAt = emailOptOut ? new Date() : null;
    }

    if (
      whatsappOptOut !== undefined &&
      whatsappOptOut !== existing.whatsappOptOut
    ) {
      data.whatsappOptOut = whatsappOptOut;
      data.whatsappOptOutAt = whatsappOptOut ? new Date() : null;
    }

    if (
      updatePersonDto.followUpStatus === undefined &&
      updatePersonDto.membershipStatus &&
      updatePersonDto.membershipStatus !== MembershipStatus.VISITOR &&
      existing.followUpStatus === FollowUpStatus.PENDING
    ) {
      data.followUpStatus = null;
    }

    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  /**
   * Merges email sends, birthday greetings and WhatsApp outreach into one
   * newest-first timeline. WhatsApp birthday greetings are skipped because the
   * outreach row that produced them is already listed, and email greetings are
   * skipped when their send log exists.
   */
  async getMessages(
    id: string,
    query: QueryPersonMessagesDto,
    userChurchId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const person = await this.prisma.person.findFirst({
      where: { id, churchId },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException(`Person with ID "${id}" not found`);
    }

    const [emails, greetings, outreach] = await Promise.all([
      this.prisma.emailSendLog.findMany({
        where: { personId: id, churchId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.birthdayGreeting.findMany({
        where: { personId: id, churchId, channel: MessageChannel.EMAIL },
        include: { sentBy: { select: SENDER_SELECT } },
      }),
      this.prisma.outreachMessage.findMany({
        where: { personId: id, churchId },
        include: { sentBy: { select: SENDER_SELECT } },
      }),
    ]);

    const senderIds = [
      ...new Set(
        emails.map((e) => e.sentByUserId).filter((s): s is string => !!s),
      ),
    ];
    const senders = senderIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: senderIds } },
          select: SENDER_SELECT,
        })
      : [];
    const senderById = new Map(senders.map((u) => [u.id, u]));

    const birthdayLogTimes = emails
      .filter((e) => e.emailType === 'BIRTHDAY_GREETING')
      .map((e) => e.createdAt.getTime());

    const entries: PersonMessageEntry[] = [
      ...emails.map((e) => ({
        type: MessageChannel.EMAIL,
        purpose: e.emailType,
        at: e.createdAt,
        by: this.formatSender(
          e.sentByUserId,
          senderById.get(e.sentByUserId ?? ''),
        ),
        status: 'SENT',
        preview: this.preview(e.subject ?? ''),
        refId: e.id,
      })),
      ...greetings
        .filter(
          (g) =>
            !birthdayLogTimes.some(
              (t) => Math.abs(t - g.createdAt.getTime()) <= DAY_MS,
            ),
        )
        .map((g) => ({
          type: MessageChannel.EMAIL,
          purpose: 'BIRTHDAY_GREETING',
          at: g.createdAt,
          by: this.formatSender(g.sentByUserId, g.sentBy),
          status: 'SENT',
          preview: this.preview(g.subject ?? g.message),
          refId: g.id,
        })),
      ...outreach.map((o) => ({
        type: o.channel,
        purpose: o.purpose,
        at: o.openedAt,
        by: this.formatSender(o.sentByUserId, o.sentBy),
        status: o.status,
        preview: this.preview(o.body),
        refId: o.id,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    const total = entries.length;
    return {
      items: entries.slice((page - 1) * limit, page * limit),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  private formatSender(
    userId: string | null,
    user?: { firstName: string; displayName: string | null } | null,
  ) {
    if (!userId || !user) return null;
    return { id: userId, name: user.displayName?.trim() || user.firstName };
  }

  private preview(text: string): string {
    const plain = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length > MESSAGE_PREVIEW_LENGTH
      ? `${plain.slice(0, MESSAGE_PREVIEW_LENGTH)}…`
      : plain;
  }

  async promote(id: string, dto: PromotePersonDto, userChurchId?: string) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id, churchId: targetChurchId },
      include: {
        departmentMemberships: {
          include: { department: true },
        },
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${id}" not found`);
    }

    const hasEmail = person.email && person.email.trim() !== '';
    const hasPhone = person.phone && person.phone.trim() !== '';
    if (!hasEmail && !hasPhone) {
      throw new BadRequestException(
        'Person must have at least an email address or phone number on record before being promoted',
      );
    }

    const hierarchy: Record<MembershipStatus, number> = {
      [MembershipStatus.VISITOR]: 1,
      [MembershipStatus.MEMBER]: 2,
      [MembershipStatus.WORKER]: 3,
      [MembershipStatus.LEADER]: 4,
      [MembershipStatus.PASTOR]: 5,
    };

    const currentRank = hierarchy[person.membershipStatus] ?? 0;
    const targetRank = hierarchy[dto.membershipStatus] ?? 0;

    if (targetRank <= currentRank) {
      throw new BadRequestException(
        `Cannot promote person from ${person.membershipStatus} to ${dto.membershipStatus}. The promote endpoint is only for upward progression.`,
      );
    }

    const data: Prisma.PersonUpdateInput = {
      membershipStatus: dto.membershipStatus,
    };

    if (
      person.followUpStatus === FollowUpStatus.PENDING ||
      person.followUpStatus === FollowUpStatus.IN_PROGRESS
    ) {
      data.followUpStatus = FollowUpStatus.CONVERTED;
    }

    return this.prisma.person.update({
      where: { id },
      data,
      include: {
        departmentMemberships: {
          include: { department: true },
        },
      },
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.person.delete({
      where: { id },
    });

    return { message: `Person with ID "${id}" deleted successfully` };
  }
}
