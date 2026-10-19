import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimProfileDto } from './dto/claim-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly departmentsService: DepartmentsService,
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
  ) {}

  async claim(dto: ClaimProfileDto): Promise<{ message: string }> {
    const rawEmail = dto.email?.trim().toLowerCase();
    const rawPhone = dto.phone?.trim();

    if (!rawEmail && !rawPhone) {
      throw new BadRequestException(
        'Please provide an email address or phone number to claim your profile',
      );
    }

    // 1. Resolve church
    let churchId: string;
    if (dto.churchSlug) {
      const church = await this.prisma.church.findUnique({
        where: { slug: dto.churchSlug.trim() },
      });
      if (!church) {
        throw new NotFoundException(
          `Church with slug "${dto.churchSlug}" not found`,
        );
      }
      churchId = church.id;
    } else {
      churchId = await this.prisma.getDefaultChurchId();
    }

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church not found`);
    }

    // 2. Lookup existing Person or create visitor
    const conditions: Prisma.PersonWhereInput[] = [];
    if (rawEmail) conditions.push({ email: rawEmail });
    if (rawPhone) conditions.push({ phone: rawPhone });

    let person = await this.prisma.person.findFirst({
      where: {
        churchId,
        OR: conditions,
      },
    });

    if (!person) {
      // Derive default names if newly registered
      const defaultFirstName = rawEmail
        ? rawEmail.split('@')[0].replace(/[^a-zA-Z]/g, ' ') || 'Friend'
        : 'Friend';
      const capitalizedFirstName =
        defaultFirstName.charAt(0).toUpperCase() + defaultFirstName.slice(1);

      person = await this.prisma.person.create({
        data: {
          churchId,
          firstName: capitalizedFirstName,
          lastName: 'Guest',
          email: rawEmail || null,
          phone: rawPhone || null,
          membershipStatus: MembershipStatus.VISITOR,
        },
      });
    }

    // 3. Generate secure magic link token (30-minute expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        profileToken: token,
        profileTokenExpiresAt: expiresAt,
      },
    });

    // 4. Send magic link email if email is present
    const recipientEmail = person.email || rawEmail;
    if (recipientEmail) {
      const appUrl =
        this.configService.get<string>('appUrl')?.replace(/\/+$/, '') ||
        'http://localhost:3000';
      const profileBaseUrl =
        this.configService.get<string>('profileUrl')?.replace(/\/+$/, '') ||
        `${appUrl}/profile`;
      const magicLinkUrl = `${profileBaseUrl}/${token}`;

      try {
        await this.emailProvider.sendCustomBroadcast({
          recipientEmail,
          recipientName: `${person.firstName} ${person.lastName}`.trim(),
          subject: `Your ${church.name} Profile Magic Link`,
          heading: `Manage Your Church Profile`,
          message: `Hello ${person.firstName}, here is your secure link to access and update your member profile, membership status, and departments. This link is valid for 30 minutes.`,
          ctaLabel: `View & Update Profile`,
          ctaUrl: magicLinkUrl,
          churchName: church.name,
          contactEmail: church.email || undefined,
          contactPhone: church.phone || undefined,
          churchId: church.id,
          personId: person.id,
          emailType: 'MAGIC_LINK',
        });
      } catch (error) {
        this.logger.error(
          `Failed to dispatch magic link email to ${recipientEmail}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return {
      message:
        'If an account or record matches this contact, a magic link has been sent.',
    };
  }

  async getByToken(token: string) {
    if (!token || token.trim() === '') {
      throw new BadRequestException('Token is required');
    }

    const person = await this.prisma.person.findUnique({
      where: { profileToken: token },
      include: {
        church: {
          select: {
            id: true,
            name: true,
            slug: true,
            branchName: true,
            campusName: true,
            email: true,
            phone: true,
            websiteUrl: true,
          },
        },
        departmentMemberships: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!person) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    if (
      !person.profileTokenExpiresAt ||
      person.profileTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Magic link has expired. Please request a new one.',
      );
    }

    const availableDepartments = await this.departmentsService.listForChurch(
      person.churchId,
    );

    return {
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        phone: person.phone,
        gender: person.gender,
        dateOfBirth: person.dateOfBirth
          ? person.dateOfBirth.toISOString().split('T')[0]
          : null,
        address: person.address,
        membershipStatus: person.membershipStatus,
        departments: person.departmentMemberships.map((m) => ({
          id: m.department.id,
          name: m.department.name,
          description: m.department.description,
          role: m.role,
          joinedAt: m.joinedAt,
        })),
      },
      church: person.church,
      availableDepartments,
    };
  }

  async updateByToken(token: string, dto: UpdateProfileDto) {
    if (!token || token.trim() === '') {
      throw new BadRequestException('Token is required');
    }

    const person = await this.prisma.person.findUnique({
      where: { profileToken: token },
      include: {
        church: true,
        departmentMemberships: true,
      },
    });

    if (!person) {
      throw new BadRequestException('Invalid or expired magic link');
    }

    if (
      !person.profileTokenExpiresAt ||
      person.profileTokenExpiresAt < new Date()
    ) {
      throw new BadRequestException(
        'Magic link has expired. Please request a new one.',
      );
    }

    // Validate department IDs if provided
    if (dto.departmentIds && dto.departmentIds.length > 0) {
      const validDepts = await this.prisma.department.findMany({
        where: {
          id: { in: dto.departmentIds },
          churchId: person.churchId,
        },
        select: { id: true },
      });

      if (validDepts.length !== dto.departmentIds.length) {
        throw new BadRequestException(
          'One or more selected departments do not exist in this church',
        );
      }
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      gender,
      dateOfBirth,
      address,
      membershipStatus,
      departmentIds,
    } = dto;

    const personUpdateData: Prisma.PersonUpdateInput = {
      // Invalidate the token upon successful save (single-use)
      profileToken: null,
      profileTokenExpiresAt: null,
    };

    if (firstName !== undefined) personUpdateData.firstName = firstName.trim();
    if (lastName !== undefined) personUpdateData.lastName = lastName.trim();
    if (email !== undefined)
      personUpdateData.email = email.trim().toLowerCase();
    if (phone !== undefined) personUpdateData.phone = phone.trim();
    if (gender !== undefined) personUpdateData.gender = gender;
    if (address !== undefined)
      personUpdateData.address = address?.trim() || null;
    if (membershipStatus !== undefined)
      personUpdateData.membershipStatus = membershipStatus;
    if (dateOfBirth !== undefined) {
      personUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    // Transaction to update Person and Department Memberships atomically
    return this.prisma.$transaction(async (tx) => {
      const updatedPerson = await tx.person.update({
        where: { id: person.id },
        data: personUpdateData,
      });

      if (departmentIds !== undefined) {
        // Remove memberships not in departmentIds
        await tx.departmentMembership.deleteMany({
          where: {
            personId: person.id,
            departmentId: { notIn: departmentIds },
          },
        });

        // Add newly selected memberships
        const existingDeptIds = new Set(
          person.departmentMemberships.map((m) => m.departmentId),
        );

        const newDeptIds = departmentIds.filter(
          (deptId) => !existingDeptIds.has(deptId),
        );

        for (const deptId of newDeptIds) {
          await tx.departmentMembership.create({
            data: {
              personId: person.id,
              departmentId: deptId,
              role: 'Member',
            },
          });
        }
      }

      const freshDepartments = await tx.departmentMembership.findMany({
        where: { personId: person.id },
        include: {
          department: {
            select: { id: true, name: true, description: true },
          },
        },
      });

      return {
        message: 'Profile updated successfully',
        person: {
          id: updatedPerson.id,
          firstName: updatedPerson.firstName,
          lastName: updatedPerson.lastName,
          email: updatedPerson.email,
          phone: updatedPerson.phone,
          gender: updatedPerson.gender,
          dateOfBirth: updatedPerson.dateOfBirth
            ? updatedPerson.dateOfBirth.toISOString().split('T')[0]
            : null,
          address: updatedPerson.address,
          membershipStatus: updatedPerson.membershipStatus,
          departments: freshDepartments.map((m) => ({
            id: m.department.id,
            name: m.department.name,
            description: m.department.description,
            role: m.role,
            joinedAt: m.joinedAt,
          })),
        },
      };
    });
  }
}
