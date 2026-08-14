import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { QueryUserDto } from './dto/query-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  churchId: true,
  createdAt: true,
  updatedAt: true,
  lastActive: true,
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
        church: true,
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
    const existingUser = await this.findOne(id, userChurchId);

    if (dto.email && dto.email !== existingUser.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (emailTaken) {
        throw new ConflictException(
          `A user with email "${dto.email}" already exists`,
        );
      }
    }

    // Handle Role updates
    if (dto.role) {
      const roleName = dto.role.toUpperCase();
      const role = await this.prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `${roleName} user role`,
        },
      });

      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      await this.prisma.userRole.create({
        data: {
          userId: id,
          roleId: role.id,
        },
      });
    }

    // Sync corresponding Person record if membershipStatus or role changed
    const targetEmail = dto.email ?? existingUser.email;
    const targetFirstName = dto.firstName ?? existingUser.firstName;
    const targetLastName = dto.lastName ?? existingUser.lastName;
    const targetPhone = dto.phone ?? existingUser.phone;

    let targetMembershipStatus = dto.membershipStatus;
    if (!targetMembershipStatus && dto.role) {
      const upperRole = dto.role.toUpperCase();
      if (upperRole === 'MEMBER') targetMembershipStatus = 'MEMBER';
      else if (upperRole === 'WORKER') targetMembershipStatus = 'WORKER';
      else if (upperRole === 'LEADER') targetMembershipStatus = 'LEADER';
      else if (upperRole === 'ADMIN' || upperRole === 'SUPER_ADMIN')
        targetMembershipStatus = 'WORKER';
    }

    if (targetMembershipStatus && targetEmail) {
      const person = await this.prisma.person.findFirst({
        where: { email: targetEmail, churchId: existingUser.churchId },
      });

      if (person) {
        await this.prisma.person.update({
          where: { id: person.id },
          data: {
            membershipStatus: targetMembershipStatus,
            firstName: targetFirstName,
            lastName: targetLastName,
            phone: targetPhone ?? person.phone,
          },
        });
      } else {
        await this.prisma.person.create({
          data: {
            churchId: existingUser.churchId,
            email: targetEmail,
            firstName: targetFirstName,
            lastName: targetLastName,
            phone: targetPhone,
            membershipStatus: targetMembershipStatus,
          },
        });
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
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

  async remove(id: string, currentUser: ActiveUserData) {
    if (currentUser.sub === id) {
      throw new BadRequestException('You cannot delete your own account');
    }

    const targetUser = await this.findOne(id, currentUser.churchId);

    const isTargetSuperAdmin = targetUser.userRoles.some(
      (ur) => ur.role.name === 'SUPER_ADMIN',
    );

    const isCurrentSuperAdmin = currentUser.roles?.includes('SUPER_ADMIN');

    if (isTargetSuperAdmin && !isCurrentSuperAdmin) {
      throw new ForbiddenException('Admins cannot delete Super Admin users');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }
}
