import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddDepartmentMemberDto } from './dto/add-department-member.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { QueryDepartmentDto } from './dto/query-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDepartmentDto: CreateDepartmentDto,
    userChurchId?: string,
  ) {
    const { name, description, churchId: dtoChurchId } = createDepartmentDto;
    const churchId =
      dtoChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    const existing = await this.prisma.department.findUnique({
      where: {
        churchId_name: {
          churchId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Department with name "${name.trim()}" already exists in this church`,
      );
    }

    return this.prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim(),
        churchId,
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  private buildWhere(
    query: QueryDepartmentDto,
    churchId: string,
  ): Prisma.DepartmentWhereInput {
    const { search } = query;

    const where: Prisma.DepartmentWhereInput = {
      churchId,
    };

    if (search && search.trim() !== '') {
      where.OR = [
        { name: { contains: search.trim() } },
        { description: { contains: search.trim() } },
      ];
    }

    return where;
  }

  async findAll(query: QueryDepartmentDto, userChurchId?: string) {
    const { churchId: queryChurchId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const targetChurchId =
      queryChurchId || userChurchId || (await this.prisma.getDefaultChurchId());

    const where = this.buildWhere(query, targetChurchId);

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { members: true },
          },
        },
      }),
      this.prisma.department.count({ where }),
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

    const department = await this.prisma.department.findFirst({
      where: { id, churchId: targetChurchId },
      include: {
        members: {
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
          },
          orderBy: { joinedAt: 'desc' },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    return department;
  }

  async update(
    id: string,
    updateDepartmentDto: UpdateDepartmentDto,
    userChurchId?: string,
  ) {
    const existing = await this.findOne(id, userChurchId);

    const { name, description } = updateDepartmentDto;

    if (name && name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.department.findUnique({
        where: {
          churchId_name: {
            churchId: existing.churchId,
            name: name.trim(),
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `Department with name "${name.trim()}" already exists in this church`,
        );
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() }),
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });
  }

  async remove(id: string, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    await this.prisma.department.delete({
      where: { id },
    });

    return { message: `Department with ID "${id}" deleted successfully` };
  }

  async addMember(
    departmentId: string,
    dto: AddDepartmentMemberDto,
    userChurchId?: string,
  ) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, churchId: targetChurchId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with ID "${departmentId}" not found`,
      );
    }

    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, churchId: targetChurchId },
    });
    if (!person) {
      throw new NotFoundException(`Person with ID "${dto.personId}" not found`);
    }

    return this.prisma.departmentMembership.upsert({
      where: {
        personId_departmentId: {
          personId: dto.personId,
          departmentId,
        },
      },
      update: {
        role: dto.role?.trim() || null,
      },
      create: {
        personId: dto.personId,
        departmentId,
        role: dto.role?.trim() || null,
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
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
      },
    });
  }

  async removeMember(
    departmentId: string,
    personId: string,
    userChurchId?: string,
  ) {
    const targetChurchId =
      userChurchId || (await this.prisma.getDefaultChurchId());

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, churchId: targetChurchId },
    });
    if (!department) {
      throw new NotFoundException(
        `Department with ID "${departmentId}" not found`,
      );
    }

    const membership = await this.prisma.departmentMembership.findUnique({
      where: {
        personId_departmentId: {
          personId,
          departmentId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        `Person "${personId}" is not a member of department "${departmentId}"`,
      );
    }

    await this.prisma.departmentMembership.delete({
      where: {
        personId_departmentId: {
          personId,
          departmentId,
        },
      },
    });

    return {
      message: `Person removed from department successfully`,
    };
  }

  async listForChurch(churchId: string) {
    return this.prisma.department.findMany({
      where: { churchId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });
  }
}
