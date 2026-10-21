import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { CheckInStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { QueryCheckInDto } from './dto/query-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDto: CreateCheckInDto,
    currentUser: { id?: string; sub?: string; churchId?: string },
  ) {
    const creatorId = currentUser.sub || currentUser.id;
    if (!creatorId) {
      throw new UnauthorizedException(
        'Unable to identify the authenticated user creating this check-in',
      );
    }

    const targetChurchId =
      currentUser.churchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id: createDto.personId, churchId: targetChurchId },
    });
    if (!person) {
      throw new NotFoundException(
        `Person with ID "${createDto.personId}" not found in this church`,
      );
    }

    if (createDto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: createDto.assignedToId, churchId: targetChurchId },
      });
      if (!assignee) {
        throw new NotFoundException(
          `Assigned user with ID "${createDto.assignedToId}" not found in this church`,
        );
      }
    }

    const { scheduledFor, completedAt, status, ...rest } = createDto;

    const resolvedStatus = status ?? CheckInStatus.SCHEDULED;
    let resolvedCompletedAt: Date | null = null;
    if (completedAt) {
      resolvedCompletedAt = new Date(completedAt);
    } else if (resolvedStatus === CheckInStatus.COMPLETED) {
      resolvedCompletedAt = new Date();
    }

    return this.prisma.pastoralCheckIn.create({
      data: {
        ...rest,
        churchId: targetChurchId,
        createdById: creatorId,
        status: resolvedStatus,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        completedAt: resolvedCompletedAt,
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            membershipStatus: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  private buildWhere(
    query: QueryCheckInDto,
    targetChurchId: string,
  ): Prisma.PastoralCheckInWhereInput {
    const { personId, assignedToId, status, reason, search } = query;

    const where: Prisma.PastoralCheckInWhereInput = {
      churchId: targetChurchId,
    };

    if (personId) {
      where.personId = personId;
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) {
      where.status = status;
    }

    if (reason) {
      where.reason = reason;
    }

    if (search) {
      where.OR = [
        { notes: { contains: search } },
        { outcome: { contains: search } },
        {
          person: {
            OR: [
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          },
        },
      ];
    }

    return where;
  }

  async findAll(query: QueryCheckInDto, userChurchId?: string) {
    const { churchId: queryChurchId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const targetChurchId =
      queryChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, targetChurchId);

    const [items, total] = await Promise.all([
      this.prisma.pastoralCheckIn.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              membershipStatus: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.pastoralCheckIn.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async findOne(id: string, userChurchId?: string) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const checkIn = await this.prisma.pastoralCheckIn.findFirst({
      where: { id, churchId: targetChurchId },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            membershipStatus: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!checkIn) {
      throw new NotFoundException(
        `Pastoral check-in with ID "${id}" not found`,
      );
    }

    return checkIn;
  }

  async findByPerson(personId: string, userChurchId?: string) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id: personId, churchId: targetChurchId },
    });
    if (!person) {
      throw new NotFoundException(
        `Person with ID "${personId}" not found in this church`,
      );
    }

    return this.prisma.pastoralCheckIn.findMany({
      where: { personId, churchId: targetChurchId },
      orderBy: { createdAt: 'desc' },
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
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async update(id: string, updateDto: UpdateCheckInDto, userChurchId?: string) {
    const existing = await this.findOne(id, userChurchId);
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    if (updateDto.personId && updateDto.personId !== existing.personId) {
      const person = await this.prisma.person.findFirst({
        where: { id: updateDto.personId, churchId: targetChurchId },
      });
      if (!person) {
        throw new NotFoundException(
          `Person with ID "${updateDto.personId}" not found in this church`,
        );
      }
    }

    if (updateDto.assignedToId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: updateDto.assignedToId, churchId: targetChurchId },
      });
      if (!assignee) {
        throw new NotFoundException(
          `Assigned user with ID "${updateDto.assignedToId}" not found in this church`,
        );
      }
    }

    const { scheduledFor, completedAt, status, ...rest } = updateDto;

    const data: Prisma.PastoralCheckInUpdateInput = { ...rest };

    if (status !== undefined) {
      data.status = status;
      if (
        status === CheckInStatus.COMPLETED &&
        !existing.completedAt &&
        completedAt === undefined
      ) {
        data.completedAt = new Date();
      }
    }

    if (scheduledFor !== undefined) {
      data.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
    }

    if (completedAt !== undefined) {
      data.completedAt = completedAt ? new Date(completedAt) : null;
    }

    return this.prisma.pastoralCheckIn.update({
      where: { id },
      data,
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            membershipStatus: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.pastoralCheckIn.delete({
      where: { id },
    });

    return {
      message: `Pastoral check-in with ID "${id}" deleted successfully`,
    };
  }
}
