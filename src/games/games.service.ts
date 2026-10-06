import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CSV_EXPORT_MAX_ROWS } from '../common/utils/csv.util';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { QueryGameDto } from './dto/query-game.dto';

const GAME_INCLUDE = {
  event: {
    select: { id: true, title: true },
  },
  scores: {
    include: {
      team: {
        select: { id: true, name: true, color: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  },
  _count: {
    select: { scores: true },
  },
} satisfies Prisma.GameInclude;

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createGameDto: CreateGameDto, userChurchId?: string) {
    const { eventId, name, description, maxScore } = createGameDto;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, churchId },
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
      include: GAME_INCLUDE,
    });
  }

  private buildWhere(
    query: QueryGameDto,
    churchId: string,
  ): Prisma.GameWhereInput {
    const { eventId, search } = query;

    const where: Prisma.GameWhereInput = {
      event: {
        churchId,
      },
    };

    if (eventId) {
      where.eventId = eventId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    return where;
  }

  async findAll(query: QueryGameDto, userChurchId?: string) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, churchId);

    const [items, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: GAME_INCLUDE,
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

  async exportAll(query: QueryGameDto, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const where = this.buildWhere(query, churchId);

    return this.prisma.game.findMany({
      where,
      take: CSV_EXPORT_MAX_ROWS,
      orderBy: { name: 'asc' },
      include: {
        event: { select: { id: true, title: true } },
        _count: { select: { scores: true } },
      },
    });
  }

  async findOne(id: string, userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const game = await this.prisma.game.findFirst({
      where: {
        id,
        event: {
          churchId,
        },
      },
      include: GAME_INCLUDE,
    });

    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }

    return game;
  }

  async update(
    id: string,
    updateGameDto: UpdateGameDto,
    userChurchId?: string,
  ) {
    await this.findOne(id, userChurchId);

    const { eventId, ...rest } = updateGameDto;
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    if (eventId) {
      const event = await this.prisma.event.findFirst({
        where: { id: eventId, churchId },
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
      include: GAME_INCLUDE,
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.game.delete({
      where: { id },
    });

    return { message: `Game with ID "${id}" deleted successfully` };
  }
}
