import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }
}
