import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import {
  normalizePhone,
  normalizePhoneOrThrow,
} from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimRateLimiter } from './claim-rate-limiter';
import { ClaimProfileDto } from './dto/claim-profile.dto';
import { MemberLoginDto } from './dto/member-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_LINK_TTL_MS = 30 * 60 * 1000;
/** After first opening a valid link, the form may be saved for this long. */
const PROFILE_SAVE_GRACE_MS = 30 * 60 * 1000;
const CLAIM_RESPONSE_MESSAGE =
  'If an account or record matches this contact, a magic link has been sent.';

const TOKEN_PERSON_INCLUDE = {
  church: {
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      branchName: true,
      campusName: true,
      email: true,
      phone: true,
      whatsappNumber: true,
      websiteUrl: true,
    },
  },
  departmentMemberships: {
    include: {
      department: {
        select: { id: true, name: true, description: true },
      },
    },
    orderBy: { joinedAt: 'asc' as const },
  },
} satisfies Prisma.PersonInclude;

type TokenPerson = Prisma.PersonGetPayload<{
  include: typeof TOKEN_PERSON_INCLUDE;
}>;

function linkError(message: string, code: string): BadRequestException {
  return new BadRequestException({ message, code });
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly departmentsService: DepartmentsService,
    private readonly claimRateLimiter: ClaimRateLimiter,
    private readonly jwtService: JwtService,
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
  ) {}

  async claim(dto: ClaimProfileDto): Promise<{ message: string }> {
    const rawEmail = dto.email?.trim().toLowerCase();
    const submittedPhone = dto.phone?.trim();
    // Public endpoint: an unusable number is ignored rather than rejected.
    const rawPhone = submittedPhone ? normalizePhone(submittedPhone) : null;
    if (submittedPhone && !rawPhone) {
      this.logger.warn('Ignoring invalid phone number on profile claim');
    }

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
    if (rawPhone) {
      conditions.push({ phone: rawPhone });
      if (submittedPhone && submittedPhone !== rawPhone) {
        conditions.push({ phone: submittedPhone });
      }
    }

    let person = await this.prisma.person.findFirst({
      where: {
        churchId,
        OR: conditions,
      },
    });

    // Links are only ever emailed, so without an address there is nothing to do.
    const recipientEmail = person?.email || rawEmail;
    if (!recipientEmail) {
      return { message: CLAIM_RESPONSE_MESSAGE };
    }

    // Over the per-email limit: answer exactly like a success and send nothing.
    if (!this.claimRateLimiter.tryConsume(recipientEmail.toLowerCase())) {
      return { message: CLAIM_RESPONSE_MESSAGE };
    }

    if (!person) {
      person = await this.prisma.person.create({
        data: {
          churchId,
          firstName: 'New',
          lastName: 'Visitor',
          namesConfirmed: false,
          email: rawEmail,
          phone: rawPhone || null,
          membershipStatus: MembershipStatus.VISITOR,
        },
      });
    }

    // 3. Generate secure single-use token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PROFILE_LINK_TTL_MS);

    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        profileToken: token,
        profileTokenExpiresAt: expiresAt,
        profileTokenOpenedAt: null,
      },
    });

    // 4. Send the secure link email
    const appUrl =
      this.configService.get<string>('appUrl')?.replace(/\/+$/, '') ||
      'http://localhost:3000';
    const profileBaseUrl =
      this.configService.get<string>('profileUrl')?.replace(/\/+$/, '') ||
      `${appUrl}/profile`;
    const profileLinkUrl = `${profileBaseUrl}/${token}`;
    const churchShortName = church.shortName?.trim() || church.name;
    const greeting = person.namesConfirmed
      ? `Hello ${person.firstName},`
      : 'Hello,';

    try {
      await this.emailProvider.sendCustomBroadcast({
        recipientEmail,
        recipientName: person.namesConfirmed
          ? `${person.firstName} ${person.lastName}`.trim()
          : recipientEmail,
        subject: `Update your details with ${churchShortName}`,
        heading: 'Your secure link',
        message: `${greeting} use the button below to update your details with ${churchShortName}. The link expires in 30 minutes and can be used once.`,
        ctaLabel: 'Update my details',
        ctaUrl: profileLinkUrl,
        churchName: church.name,
        contactEmail: church.email || undefined,
        contactPhone: church.phone || undefined,
        churchId: church.id,
        personId: person.id,
        emailType: 'MAGIC_LINK',
      });
    } catch (error) {
      this.logger.error(
        `Failed to dispatch profile link email to ${recipientEmail}: ${error instanceof Error ? error.message : error}`,
      );
    }

    return { message: CLAIM_RESPONSE_MESSAGE };
  }

  /**
   * Single place that decides whether a profile token may be used, so the GET
   * and PATCH rules cannot drift apart.
   */
  private async resolveToken(
    token: string,
    { forUpdate }: { forUpdate: boolean },
  ): Promise<TokenPerson> {
    if (!token || token.trim() === '') {
      throw linkError('Token is required', 'PROFILE_LINK_INVALID');
    }

    const person = await this.prisma.person.findUnique({
      where: { profileToken: token },
      include: TOKEN_PERSON_INCLUDE,
    });

    if (!person) {
      throw linkError('Invalid or expired magic link', 'PROFILE_LINK_INVALID');
    }

    const now = Date.now();
    const expiresAt = person.profileTokenExpiresAt;
    if (!expiresAt) {
      throw linkError(
        'Magic link has expired. Please request a new one.',
        'PROFILE_LINK_EXPIRED',
      );
    }

    if (expiresAt.getTime() >= now) return person;

    // Expired: a form opened in time may still be saved during the grace window.
    const openedAt = person.profileTokenOpenedAt;
    const withinGrace =
      forUpdate &&
      openedAt &&
      openedAt.getTime() <= expiresAt.getTime() &&
      now <= openedAt.getTime() + PROFILE_SAVE_GRACE_MS;
    if (!withinGrace) {
      throw linkError(
        'Magic link has expired. Please request a new one.',
        'PROFILE_LINK_EXPIRED',
      );
    }
    return person;
  }

  async getByToken(token: string) {
    const person = await this.resolveToken(token, { forUpdate: false });

    if (!person.profileTokenOpenedAt) {
      await this.prisma.person.update({
        where: { id: person.id },
        data: { profileTokenOpenedAt: new Date() },
      });
    }

    const availableDepartments = await this.departmentsService.listForChurch(
      person.churchId,
    );

    return {
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        namesConfirmed: person.namesConfirmed,
        hasPin: Boolean(person.pinHash),
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
    const person = await this.resolveToken(token, { forUpdate: true });

    if (
      !person.namesConfirmed &&
      (!dto.firstName?.trim() || !dto.lastName?.trim())
    ) {
      throw new BadRequestException({
        message: 'First name and last name are required',
        code: 'NAMES_REQUIRED',
      });
    }

    const effectiveStatus = dto.membershipStatus ?? person.membershipStatus;
    // Visitors and members have no departments: treat the request as a clear.
    const departmentIds =
      effectiveStatus === MembershipStatus.VISITOR ||
      effectiveStatus === MembershipStatus.MEMBER
        ? []
        : dto.departmentIds;

    // Validate department IDs if provided
    if (departmentIds && departmentIds.length > 0) {
      const validDepts = await this.prisma.department.findMany({
        where: {
          id: { in: departmentIds },
          churchId: person.churchId,
        },
        select: { id: true },
      });

      if (validDepts.length !== departmentIds.length) {
        throw new BadRequestException(
          'One or more selected departments do not exist in this church',
        );
      }
    }

    if (effectiveStatus === MembershipStatus.WORKER) {
      const resultingCount =
        departmentIds?.length ?? person.departmentMemberships.length;
      if (resultingCount === 0) {
        const churchDepartments = await this.prisma.department.count({
          where: { churchId: person.churchId },
        });
        if (churchDepartments > 0) {
          throw new BadRequestException({
            message: 'Workers must select at least one department',
            code: 'DEPARTMENT_REQUIRED',
          });
        }
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
    } = dto;

    const personUpdateData: Prisma.PersonUpdateInput = {
      // Invalidate the token upon successful save (single-use)
      profileToken: null,
      profileTokenExpiresAt: null,
      profileTokenOpenedAt: null,
      namesConfirmed: true,
    };

    if (firstName !== undefined) personUpdateData.firstName = firstName.trim();
    if (lastName !== undefined) personUpdateData.lastName = lastName.trim();
    if (email !== undefined)
      personUpdateData.email = email.trim().toLowerCase();
    if (phone !== undefined)
      personUpdateData.phone = normalizePhoneOrThrow(phone);
    if (gender !== undefined) personUpdateData.gender = gender;
    if (address !== undefined)
      personUpdateData.address = address?.trim() || null;
    if (membershipStatus !== undefined)
      personUpdateData.membershipStatus = membershipStatus;
    if (dateOfBirth !== undefined) {
      personUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (dto.pin) {
      personUpdateData.pinHash = await bcrypt.hash(dto.pin, 10);
      personUpdateData.pinFailedAttempts = 0;
      personUpdateData.pinLockedUntil = null;
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
          namesConfirmed: updatedPerson.namesConfirmed,
          hasPin: Boolean(updatedPerson.pinHash),
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

  async login(dto: MemberLoginDto) {
    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');
    const email = isEmail ? rawIdentifier.toLowerCase() : null;
    const phone = !isEmail ? normalizePhone(rawIdentifier) : null;

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

    // 2. Find Person
    let person: TokenPerson | null = null;
    if (email) {
      person = await this.prisma.person.findFirst({
        where: { email, churchId },
        include: TOKEN_PERSON_INCLUDE,
      });
    } else if (phone) {
      person = await this.prisma.person.findFirst({
        where: { phone, churchId },
        include: TOKEN_PERSON_INCLUDE,
      });
    }

    if (!person) {
      throw new UnauthorizedException({
        message: 'Invalid email/phone or PIN',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // 3. Check lockout
    const now = new Date();
    if (person.pinLockedUntil && person.pinLockedUntil > now) {
      const remainingMinutes = Math.ceil(
        (person.pinLockedUntil.getTime() - now.getTime()) / 60000,
      );
      throw new ForbiddenException({
        message: `Account is temporarily locked. Try again in ${remainingMinutes} minute(s) or use a magic link.`,
        code: 'PIN_LOCKED',
        lockedUntil: person.pinLockedUntil.toISOString(),
      });
    }

    // 4. Check if person has a PIN set
    if (!person.pinHash) {
      throw new BadRequestException({
        message:
          'No PIN has been set for this profile. Please log in using a magic link.',
        code: 'NO_PIN_SET',
      });
    }

    // 5. Verify PIN
    const isMatch = await bcrypt.compare(dto.pin, person.pinHash);
    if (!isMatch) {
      const attempts = person.pinFailedAttempts + 1;
      const maxAttempts = 5;
      const isNowLocked = attempts >= maxAttempts;
      const lockDurationMs = 15 * 60 * 1000;

      await this.prisma.person.update({
        where: { id: person.id },
        data: {
          pinFailedAttempts: isNowLocked ? 0 : attempts,
          pinLockedUntil: isNowLocked
            ? new Date(Date.now() + lockDurationMs)
            : null,
        },
      });

      if (isNowLocked) {
        throw new ForbiddenException({
          message:
            'Too many incorrect PIN attempts. Your account has been temporarily locked for 15 minutes. You can also sign in via magic link.',
          code: 'PIN_LOCKED',
        });
      }

      throw new UnauthorizedException({
        message: `Incorrect PIN. ${maxAttempts - attempts} attempt(s) remaining.`,
        code: 'INVALID_PIN',
        attemptsRemaining: maxAttempts - attempts,
      });
    }

    // 6. Reset failed attempts
    if (person.pinFailedAttempts > 0 || person.pinLockedUntil) {
      await this.prisma.person.update({
        where: { id: person.id },
        data: {
          pinFailedAttempts: 0,
          pinLockedUntil: null,
        },
      });
    }

    // 7. Generate member JWT
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '30d';

    const accessToken = await this.jwtService.signAsync(
      {
        sub: person.id,
        churchId: person.churchId,
        email: person.email,
        phone: person.phone,
        membershipStatus: person.membershipStatus,
        aud: 'dove:member',
        type: 'MEMBER',
      },
      {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn as unknown as number,
      },
    );

    return {
      message: 'Login successful',
      accessToken,
      person: {
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        namesConfirmed: person.namesConfirmed,
        hasPin: true,
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
    };
  }
}
