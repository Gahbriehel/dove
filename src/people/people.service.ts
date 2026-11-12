import {
  BadRequestException,
  ConflictException,
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
import { LinkPeopleDto } from './dto/link-people.dto';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { maskEmail, maskPhone } from '../common/utils/mask.util';
import { getInverseRelationshipType } from '../common/utils/relationship.util';
import {
  CONTACT_ALREADY_REGISTERED_CODE,
  CONTACT_ALREADY_REGISTERED_MESSAGE,
  CONTACT_REQUIRED_CODE,
  CONTACT_REQUIRED_MESSAGE,
} from './people.constants';

const DAY_MS = 24 * 60 * 60 * 1000;
const MESSAGE_PREVIEW_LENGTH = 140;

const PERSON_PRIVATE_FIELDS = [
  'pinHash',
  'pinFailedAttempts',
  'pinLockedUntil',
  'profileToken',
  'profileTokenExpiresAt',
  'profileTokenOpenedAt',
] as const;

type PersonPrivateField = (typeof PERSON_PRIVATE_FIELDS)[number];

/**
 * Strips credential/token columns from a Person row and exposes a `claimed`
 * flag instead of the raw pinHash. Every person payload that leaves the API
 * must go through this.
 */
export function toPublicPerson<T extends { pinHash?: string | null }>(
  person: T,
): Omit<T, PersonPrivateField> & { claimed: boolean } {
  const copy: Record<string, unknown> = { ...person };
  for (const field of PERSON_PRIVATE_FIELDS) delete copy[field];
  return { ...copy, claimed: Boolean(person.pinHash) } as Omit<
    T,
    PersonPrivateField
  > & { claimed: boolean };
}

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
    const { dateOfBirth, lastFollowUpAt, phone, email, ...rest } =
      createPersonDto;

    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    const normalizedEmail =
      email !== undefined ? email?.trim().toLowerCase() || null : null;
    const normalizedPhone =
      phone !== undefined ? normalizePhoneOrThrow(phone) : null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException({
        message: CONTACT_REQUIRED_MESSAGE,
        code: CONTACT_REQUIRED_CODE,
      });
    }

    if (normalizedEmail) {
      const existingEmail = await this.prisma.person.findFirst({
        where: { churchId, email: normalizedEmail },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
    }

    if (normalizedPhone) {
      const existingPhone = await this.prisma.person.findFirst({
        where: { churchId, phone: normalizedPhone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
    }

    const membershipStatus =
      createPersonDto.membershipStatus ?? MembershipStatus.VISITOR;

    const followUpStatus =
      createPersonDto.followUpStatus !== undefined
        ? createPersonDto.followUpStatus
        : membershipStatus === MembershipStatus.VISITOR
          ? FollowUpStatus.PENDING
          : null;

    try {
      const created = await this.prisma.person.create({
        data: {
          ...rest,
          ...(email !== undefined && { email: normalizedEmail }),
          ...(phone !== undefined && { phone: normalizedPhone }),
          churchId,
          membershipStatus,
          followUpStatus,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          ...(lastFollowUpAt !== undefined && {
            lastFollowUpAt: lastFollowUpAt ? new Date(lastFollowUpAt) : null,
          }),
        },
      });
      return toPublicPerson(created);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
      throw error;
    }
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
        ...toPublicPerson(person),
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
      ...toPublicPerson(person),
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
      ...toPublicPerson(person),
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
      email,
      ...rest
    } = updatePersonDto;

    const data: Prisma.PersonUpdateInput = { ...rest };

    const touchedEmail = email !== undefined;
    const touchedPhone = phone !== undefined;

    let targetEmail = existing.email;
    if (touchedEmail) {
      targetEmail = email?.trim().toLowerCase() || null;
      data.email = targetEmail;
    }

    let targetPhone = existing.phone;
    if (touchedPhone) {
      targetPhone = normalizePhoneOrThrow(phone);
      data.phone = targetPhone;
    }

    if (touchedEmail || touchedPhone) {
      if (!targetEmail && !targetPhone) {
        throw new BadRequestException({
          message: CONTACT_REQUIRED_MESSAGE,
          code: CONTACT_REQUIRED_CODE,
        });
      }
    }

    if (touchedEmail && targetEmail && targetEmail !== existing.email) {
      const emailConflict = await this.prisma.person.findFirst({
        where: {
          churchId: existing.churchId,
          email: targetEmail,
          id: { not: id },
        },
        select: { id: true },
      });
      if (emailConflict && emailConflict.id !== id) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
    }

    if (touchedPhone && targetPhone && targetPhone !== existing.phone) {
      const phoneConflict = await this.prisma.person.findFirst({
        where: {
          churchId: existing.churchId,
          phone: targetPhone,
          id: { not: id },
        },
        select: { id: true },
      });
      if (phoneConflict && phoneConflict.id !== id) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
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

    try {
      const updated = await this.prisma.person.update({
        where: { id },
        data,
      });
      return toPublicPerson(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
      throw error;
    }
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

    const promoted = await this.prisma.person.update({
      where: { id },
      data,
      include: {
        departmentMemberships: {
          include: { department: true },
        },
      },
    });
    return toPublicPerson(promoted);
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.person.delete({
      where: { id },
    });

    return { message: `Person with ID "${id}" deleted successfully` };
  }

  /**
   * Lists family members for a person (staff view).
   */
  async listRelatives(personId: string, userChurchId: string) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, churchId: userChurchId },
      select: { id: true },
    });
    if (!person) {
      throw new NotFoundException(`Person with ID "${personId}" not found`);
    }

    const relationships = await this.prisma.personRelationship.findMany({
      where: {
        churchId: userChurchId,
        OR: [{ personId }, { relatedPersonId: personId }],
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pinHash: true,
          },
        },
        relatedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pinHash: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = relationships.map((rel) => {
      const isFromPerson = rel.personId === personId;
      const targetPerson = isFromPerson ? rel.relatedPerson : rel.person;
      const relType = isFromPerson
        ? rel.type
        : getInverseRelationshipType(rel.type);
      const claimed = Boolean(targetPerson.pinHash);

      return {
        relationshipId: rel.id,
        person: {
          id: targetPerson.id,
          firstName: targetPerson.firstName,
          lastName: targetPerson.lastName,
        },
        relationship: relType,
        relationshipNote: rel.note,
        addedByMe: false,
        claimed,
        maskedEmail: maskEmail(targetPerson.email),
        maskedPhone: maskPhone(targetPerson.phone),
        canSendClaimLink: !claimed && Boolean(targetPerson.phone),
      };
    });

    return { items };
  }

  /**
   * Links two existing people in Olive (staff link).
   */
  async linkRelatives(
    personId: string,
    dto: LinkPeopleDto,
    user: ActiveUserData,
  ) {
    const churchId = user.churchId || (await this.prisma.getDefaultChurchId());

    if (personId === dto.relatedPersonId) {
      throw new BadRequestException('Cannot link a person to themselves');
    }

    const [personA, personB] = await Promise.all([
      this.prisma.person.findFirst({
        where: { id: personId, churchId },
        select: { id: true },
      }),
      this.prisma.person.findFirst({
        where: { id: dto.relatedPersonId, churchId },
        select: { id: true },
      }),
    ]);

    if (!personA) {
      throw new NotFoundException(`Person with ID "${personId}" not found`);
    }
    if (!personB) {
      throw new NotFoundException(
        `Person with ID "${dto.relatedPersonId}" not found`,
      );
    }

    const existingLink = await this.prisma.personRelationship.findFirst({
      where: {
        churchId,
        OR: [
          { personId, relatedPersonId: dto.relatedPersonId },
          { personId: dto.relatedPersonId, relatedPersonId: personId },
        ],
      },
    });

    if (existingLink) {
      throw new ConflictException(
        'A relationship between these two people already exists',
      );
    }

    const rel = await this.prisma.personRelationship.create({
      data: {
        churchId,
        personId,
        relatedPersonId: dto.relatedPersonId,
        type: dto.relationship,
        note: dto.relationshipNote?.trim() || null,
        createdByUserId: user.sub,
      },
      include: {
        relatedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pinHash: true,
          },
        },
      },
    });

    const relatedClaimed = Boolean(rel.relatedPerson.pinHash);
    return {
      relationshipId: rel.id,
      person: {
        id: rel.relatedPerson.id,
        firstName: rel.relatedPerson.firstName,
        lastName: rel.relatedPerson.lastName,
      },
      relationship: rel.type,
      relationshipNote: rel.note,
      addedByMe: false,
      claimed: relatedClaimed,
      maskedEmail: maskEmail(rel.relatedPerson.email),
      maskedPhone: maskPhone(rel.relatedPerson.phone),
      canSendClaimLink: !relatedClaimed && Boolean(rel.relatedPerson.phone),
    };
  }

  /**
   * Removes a relationship link between two people (staff action).
   */
  async deleteRelative(
    personId: string,
    relationshipId: string,
    userChurchId: string,
  ) {
    const rel = await this.prisma.personRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!rel || rel.churchId !== userChurchId) {
      throw new NotFoundException('Relationship not found');
    }

    if (rel.personId !== personId && rel.relatedPersonId !== personId) {
      throw new NotFoundException(
        'Relationship does not involve the specified person',
      );
    }

    await this.prisma.personRelationship.delete({
      where: { id: relationshipId },
    });

    return { message: 'Relationship removed successfully' };
  }
}
