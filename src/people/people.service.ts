import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { QueryPersonDto } from './dto/query-person.dto';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPersonDto: CreatePersonDto, userChurchId?: string) {
    const { churchId: bodyChurchId, dateOfBirth, ...rest } = createPersonDto;

    const churchId =
      bodyChurchId ||
      userChurchId ||
      (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    return this.prisma.person.create({
      data: {
        ...rest,
        churchId,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      },
    });
  }

  async findAll(query: QueryPersonDto, userChurchId?: string) {
    const { churchId: queryChurchId, membershipStatus, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const targetChurchId =
      queryChurchId ||
      userChurchId ||
      (await this.prisma.getDefaultChurchId());

    const where: any = {
      churchId: targetChurchId,
    };

    if (membershipStatus) {
      where.membershipStatus = membershipStatus;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.person.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          church: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: { registrations: true },
          },
        },
      }),
      this.prisma.person.count({ where }),
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
    const person = await this.prisma.person.findUnique({
      where: { id },
      include: {
        church: {
          select: { id: true, name: true, slug: true },
        },
        registrations: {
          include: {
            event: {
              select: { id: true, title: true, startDate: true, status: true },
            },
            team: {
              select: { id: true, name: true, color: true },
            },
          },
        },
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${id}" not found`);
    }

    return person;
  }

  async update(id: string, updatePersonDto: UpdatePersonDto) {
    await this.findOne(id);

    const { churchId, dateOfBirth, ...rest } = updatePersonDto;

    if (churchId) {
      const church = await this.prisma.church.findUnique({
        where: { id: churchId },
      });
      if (!church) {
        throw new NotFoundException(`Church with ID "${churchId}" not found`);
      }
    }

    const data: any = { ...rest };

    if (churchId) {
      data.churchId = churchId;
    }
    if (dateOfBirth !== undefined) {
      data.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    return this.prisma.person.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    await this.prisma.person.delete({
      where: { id },
    });

    return { message: `Person with ID "${id}" deleted successfully` };
  }
}
