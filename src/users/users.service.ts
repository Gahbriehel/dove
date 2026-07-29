import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  isActive: true,
  churchId: true,
  createdAt: true,
  updatedAt: true,
  userRoles: {
    include: {
      role: {
        select: { id: true, name: true },
      },
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        church: true,
      },
    });
  }

  async findAll(query: QueryUserDto, userChurchId?: string) {
    const { search, isActive, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const where: Prisma.UserWhereInput = { churchId };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
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
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const user = await this.prisma.user.findFirst({
      where: { id, churchId },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto, userChurchId?: string) {
    await this.findOne(id, userChurchId);

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: dto.isActive,
      },
      select: USER_SELECT,
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    churchId?: string;
    roleIds?: string[];
  }) {
    const {
      email,
      passwordHash,
      firstName,
      lastName,
      churchId: inputChurchId,
      roleIds,
    } = data;

    const churchId = inputChurchId || (await this.prisma.getDefaultChurchId());

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        `A user with email "${email}" already exists`,
      );
    }

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        churchId,
        userRoles: roleIds
          ? {
              create: roleIds.map((roleId) => ({
                roleId,
              })),
            }
          : undefined,
      },
      select: USER_SELECT,
    });
  }

  async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: newPasswordHash },
    });

    // Revoke all active refresh tokens so the user is signed out everywhere
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });
  }
}
