import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Church } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateChurchSettingsDto } from './dto/update-church-settings.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

interface UserWithRelations {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  churchId: string;
  createdAt: Date;
  updatedAt: Date;
  church?: { id: string; name: string } | null;
  userRoles?: Array<{
    role: { id: string; name: string };
  }>;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private formatChurchResponse(church: Church) {
    const branchOrCampus = church.branchName ?? church.campusName ?? null;
    const physicalOrAddress = church.address ?? null;
    const primaryOrPhone = church.phone ?? null;
    const officialOrEmail = church.email ?? null;
    const websiteOrUrl = church.websiteUrl ?? null;

    return {
      id: church.id,
      name: church.name,
      churchName: church.name,
      slug: church.slug,
      branchName: branchOrCampus,
      campusName: branchOrCampus,
      address: physicalOrAddress,
      physicalAddress: physicalOrAddress,
      phone: primaryOrPhone,
      primaryPhone: primaryOrPhone,
      email: officialOrEmail,
      officialEmail: officialOrEmail,
      websiteUrl: websiteOrUrl,
      website: websiteOrUrl,
      createdAt: church.createdAt,
      updatedAt: church.updatedAt,
    };
  }

  async getChurchSettings(userChurchId?: string) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });

    if (!church) {
      throw new NotFoundException(
        `Church record with ID "${churchId}" not found`,
      );
    }

    return this.formatChurchResponse(church);
  }

  async updateChurchSettings(
    dto: UpdateChurchSettingsDto,
    userChurchId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const existing = await this.prisma.church.findUnique({
      where: { id: churchId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Church record with ID "${churchId}" not found`,
      );
    }

    const name = dto.name ?? dto.churchName;
    const branchName = dto.branchName ?? dto.campusName;
    const campusName = dto.campusName ?? dto.branchName ?? branchName;
    const address = dto.address ?? dto.physicalAddress;
    const phone = dto.phone ?? dto.primaryPhone;
    const email = dto.email ?? dto.officialEmail;
    const websiteUrl = dto.websiteUrl ?? dto.website;

    const updated = await this.prisma.church.update({
      where: { id: churchId },
      data: {
        ...(name !== undefined && { name }),
        ...(branchName !== undefined && { branchName }),
        ...(campusName !== undefined && { campusName }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(websiteUrl !== undefined && { websiteUrl }),
      },
    });

    return {
      message: 'Church settings updated successfully',
      settings: this.formatChurchResponse(updated),
    };
  }

  private formatProfileResponse(user: UserWithRelations) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? null,
      isActive: user.isActive,
      churchId: user.churchId,
      churchName: user.church?.name ?? null,
      roles: user.userRoles ? user.userRoles.map((ur) => ur.role.name) : [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        church: { select: { id: true, name: true } },
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User profile with ID "${userId}" not found`);
    }

    return this.formatProfileResponse(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        church: { select: { id: true, name: true } },
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User profile with ID "${userId}" not found`);
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException(
          `The email address "${dto.email}" is already in use`,
        );
      }
    }

    // Verify current password if updating password
    let passwordHash: string | undefined = undefined;
    if (dto.password) {
      if (dto.currentPassword) {
        const isMatch = await bcrypt.compare(
          dto.currentPassword,
          user.passwordHash,
        );
        if (!isMatch) {
          throw new BadRequestException('Current password provided is invalid');
        }
      }
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(passwordHash !== undefined && { passwordHash }),
      },
      include: {
        church: { select: { id: true, name: true } },
        userRoles: {
          include: {
            role: { select: { id: true, name: true } },
          },
        },
      },
    });

    return {
      message: 'Profile updated successfully',
      user: this.formatProfileResponse(updated),
    };
  }
}
