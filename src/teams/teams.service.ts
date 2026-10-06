import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CSV_EXPORT_MAX_ROWS } from '../common/utils/csv.util';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { QueryTeamDto } from './dto/query-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto, userChurchId?: string) {
    const { eventId, name, color } = createTeamDto;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, churchId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    return this.prisma.team.create({
      data: {
        eventId,
        name,
        color,
      },
    });
  }

  private buildWhere(
    query: QueryTeamDto,
    churchId: string,
  ): Prisma.TeamWhereInput {
    const { eventId, search } = query;

    const where: Prisma.TeamWhereInput = {
      event: {
        churchId,
      },
    };

    if (eventId) {
      where.eventId = eventId;
    }

    if (search) {
      where.name = { contains: search };
    }

    return where;
  }

  async findAll(query: QueryTeamDto, userChurchId?: string) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, churchId);

    const [items, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          event: {
            select: { id: true, title: true },
          },
          _count: {
            select: { registrations: true, scores: true },
          },
        },
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportAll(query: QueryTeamDto, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const where = this.buildWhere(query, churchId);

    return this.prisma.team.findMany({
      where,
      take: CSV_EXPORT_MAX_ROWS,
      orderBy: { name: 'asc' },
      include: {
        event: { select: { id: true, title: true } },
        _count: { select: { registrations: true, scores: true } },
      },
    });
  }

  async findOne(id: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const team = await this.prisma.team.findFirst({
      where: {
        id,
        event: {
          churchId,
        },
      },
      include: {
        event: {
          select: { id: true, title: true },
        },
        scores: {
          include: {
            game: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }

    return team;
  }

  async update(
    id: string,
    updateTeamDto: UpdateTeamDto,
    userChurchId?: string,
  ) {
    await this.findOne(id, userChurchId);

    const { eventId, ...rest } = updateTeamDto;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    if (eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: eventId, churchId },
      });
      if (!event) {
        throw new NotFoundException(`Event with ID "${eventId}" not found`);
      }
    }

    return this.prisma.team.update({
      where: { id },
      data: {
        ...rest,
        ...(eventId && { eventId }),
      },
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.team.delete({
      where: { id },
    });

    return { message: `Team with ID "${id}" deleted successfully` };
  }
}
