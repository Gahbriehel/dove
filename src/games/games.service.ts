import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { QueryGameDto } from './dto/query-game.dto';

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGameDto: CreateGameDto) {
    const { eventId, name, description, maxScore } = createGameDto;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event with ID "${eventId}" not found`);
    }

    return this.prisma.game.create({
      data: {
        eventId,
        name,
        description,
        maxScore,
      },
    });
  }

  async findAll(query: QueryGameDto) {
    const { eventId, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (eventId) {
      where.eventId = eventId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          event: {
            select: { id: true, title: true },
          },
          _count: {
            select: { scores: true },
          },
        },
      }),
      this.prisma.game.count({ where }),
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
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        event: {
          select: { id: true, title: true },
        },
        scores: {
          include: {
            team: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }

    return game;
  }

  async update(id: string, updateGameDto: UpdateGameDto) {
    await this.findOne(id);

    const { eventId, ...rest } = updateGameDto;

    if (eventId) {
      const event = await this.prisma.event.findUnique({
        where: { id: eventId },
      });
      if (!event) {
        throw new NotFoundException(`Event with ID "${eventId}" not found`);
      }
    }

    return this.prisma.game.update({
      where: { id },
      data: {
        ...rest,
        ...(eventId && { eventId }),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.game.delete({
      where: { id },
    });

    return { message: `Game with ID "${id}" deleted successfully` };
  }
}
