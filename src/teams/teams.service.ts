import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { QueryTeamDto } from './dto/query-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTeamDto: CreateTeamDto) {
    const { eventId, name, color } = createTeamDto;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
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

  async findAll(query: QueryTeamDto) {
    const { eventId, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (eventId) {
      where.eventId = eventId;
    }

    if (search) {
      where.name = { contains: search };
    }

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

  async findOne(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
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

  async update(id: string, updateTeamDto: UpdateTeamDto) {
    await this.findOne(id);

    const { eventId, ...rest } = updateTeamDto;

    if (eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
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

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.team.delete({
      where: { id },
    });

    return { message: `Team with ID "${id}" deleted successfully` };
  }
}
