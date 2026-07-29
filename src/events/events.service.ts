import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEventDto: CreateEventDto, userChurchId?: string) {
    const {
      churchId: bodyChurchId,
      startDate,
      endDate,
      ...rest
    } = createEventDto;

    const churchId =
      bodyChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    if (new Date(startDate) >= new Date(endDate)) {
      throw new BadRequestException('startDate must be earlier than endDate');
    }

    return this.prisma.event.create({
      data: {
        ...rest,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        churchId,
      },
    });
  }

  async findAll(query: QueryEventDto, userChurchId?: string) {
    const {
      churchId: queryChurchId,
      status,
      search,
      page = 1,
      limit = 10,
    } = query;
    const skip = (page - 1) * limit;

    const targetChurchId =
      queryChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const where: Prisma.EventWhereInput = {
      churchId: targetChurchId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startDate: 'asc' },
        include: {
          church: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { registrations: true, teams: true, games: true },
          },
        },
      }),
      this.prisma.event.count({ where }),
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

  async findOne(id: string, userChurchId?: string) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const event = await this.prisma.event.findFirst({
      where: { id, churchId: targetChurchId },
      include: {
        church: {
          select: { id: true, name: true, slug: true },
        },
        teams: true,
        games: true,
        _count: {
          select: { registrations: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID "${id}" not found`);
    }

    return event;
  }

  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    userChurchId?: string,
  ) {
    const existing = await this.findOne(id, userChurchId);

    const { startDate, endDate, ...rest } = updateEventDto;

    const effectiveStart = startDate ? new Date(startDate) : existing.startDate;
    const effectiveEnd = endDate ? new Date(endDate) : existing.endDate;

    if (effectiveStart >= effectiveEnd) {
      throw new BadRequestException('startDate must be earlier than endDate');
    }

    const data: Prisma.EventUpdateInput = { ...rest };

    if (startDate) {
      data.startDate = new Date(startDate);
    }
    if (endDate) {
      data.endDate = new Date(endDate);
    }

    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.event.delete({
      where: { id },
    });

    return { message: `Event with ID "${id}" deleted successfully` };
  }
}
