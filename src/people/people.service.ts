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
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CSV_EXPORT_MAX_ROWS } from '../common/utils/csv.util';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';
import { PromotePersonDto } from './dto/promote-person.dto';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto, userChurchId?: string) {
    const { dateOfBirth, lastFollowUpAt, ...rest } = createPersonDto;

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

    const { dateOfBirth, lastFollowUpAt, ...rest } = updatePersonDto;

    const data: Prisma.PersonUpdateInput = { ...rest };

    if (dateOfBirth !== undefined) {
      data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    if (lastFollowUpAt !== undefined) {
      data.lastFollowUpAt = lastFollowUpAt ? new Date(lastFollowUpAt) : null;
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
