import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Gender, MembershipStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DepartmentsService } from '../departments/departments.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import {
  normalizePhone,
  normalizePhoneOrThrow,
  toWhatsAppDigits,
} from '../common/utils/phone.util';
import { maskEmail, maskPhone } from '../common/utils/mask.util';
import { getInverseRelationshipType } from '../common/utils/relationship.util';
import { PrismaService } from '../prisma/prisma.service';
import { ClaimRateLimiter } from './claim-rate-limiter';
import { RelativeRateLimiter } from './relative-rate-limiter';
import { ClaimProfileDto } from './dto/claim-profile.dto';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { MemberLoginDto } from './dto/member-login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePinDto } from './dto/change-pin.dto';
import { MemberSessionService } from './member-session.service';
import { MemberJwtPayload } from './guards/member-auth.guard';
import { getPhoneCandidates, validatePinStrength } from './utils/pin.util';
import {
  CONTACT_ALREADY_REGISTERED_CODE,
  CONTACT_ALREADY_REGISTERED_MESSAGE,
  CONTACT_REQUIRED_CODE,
  CONTACT_REQUIRED_MESSAGE,
} from '../people/people.constants';

export const PROFILE_LINK_TTL_MS = 30 * 60 * 1000;
export const PROFILE_WHATSAPP_LINK_TTL_MS = 48 * 60 * 60 * 1000;
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
    private readonly memberSessionService: MemberSessionService,
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
    @Optional()
    private readonly relativeRateLimiter: RelativeRateLimiter = new RelativeRateLimiter(),
  ) {}

  private formatPerson(
    person: {
      id: string;
      firstName: string;
      lastName: string;
      namesConfirmed: boolean;
      pinHash?: string | null;
      email: string | null;
      phone: string | null;
      gender: Gender | null;
      dateOfBirth: Date | null;
      address: string | null;
      membershipStatus: MembershipStatus;
    },
    departments: Array<{
      department: { id: string; name: string; description: string | null };
      role: string | null;
      joinedAt: Date;
    }>,
  ) {
    return {
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
      departments: departments.map((m) => ({
        id: m.department.id,
        name: m.department.name,
        description: m.department.description,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
    };
  }

  async generateMemberToken(person: {
    id: string;
    churchId: string;
    email?: string | null;
    phone?: string | null;
    membershipStatus?: string | null;
  }): Promise<string> {
    const jwtSecret = this.configService.get<string>('jwt.secret');
    const jwtExpiresIn =
      this.configService.get<string>('jwt.expiresIn') || '30d';

    return this.jwtService.signAsync(
      {
        sub: person.id,
        churchId: person.churchId,
        email: person.email,
        phone: person.phone,
        membershipStatus: person.membershipStatus,
        aud: 'dove:member',
        type: 'MEMBER',
        jti: crypto.randomUUID(),
      },
      {
        secret: jwtSecret,
        expiresIn: jwtExpiresIn as unknown as number,
      },
    );
  }

  async claim(dto: ClaimProfileDto): Promise<{ message: string }> {
    const submittedEmail = dto.email?.trim().toLowerCase();
    const submittedPhone = dto.phone?.trim();
    const rawPhone = submittedPhone ? normalizePhone(submittedPhone) : null;
    if (submittedPhone && !rawPhone) {
      this.logger.warn('Ignoring invalid phone number on profile claim');
    }

    if (!submittedEmail && !rawPhone) {
      throw new BadRequestException(
        'Please provide an email address or phone number to claim your profile',
      );
    }

    // Resolve church: slug wins, fallback to the seeded single church.
    let churchId: string;
    let church: {
      id: string;
      name: string;
      shortName?: string | null;
      slug: string;
      email?: string | null;
      phone?: string | null;
      whatsappNumber?: string | null;
    } | null = null;

    if (dto.churchSlug) {
      church = await this.prisma.church.findUnique({
        where: { slug: dto.churchSlug.trim() },
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          email: true,
          phone: true,
          whatsappNumber: true,
        },
      });
      if (!church) {
        throw new NotFoundException(
          `Church with slug "${dto.churchSlug}" not found`,
        );
      }
      churchId = church.id;
    } else {
      churchId = await this.prisma.getDefaultChurchId();
      church = await this.prisma.church.findUnique({
        where: { id: churchId },
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          email: true,
          phone: true,
          whatsappNumber: true,
        },
      });
    }

    // Match person: if email provided, match by email; otherwise by phone.
    let person = submittedEmail
      ? await this.prisma.person.findFirst({
          where: { churchId, email: submittedEmail },
        })
      : rawPhone
        ? await this.prisma.person.findFirst({
            where: {
              churchId,
              OR: [
                { phone: rawPhone },
                ...(submittedPhone && submittedPhone !== rawPhone
                  ? [{ phone: submittedPhone }]
                  : []),
              ],
            },
          })
        : null;

    if (!person && submittedEmail) {
      // Self-service visitor auto-creation.
      // If phone belongs to someone else, create without the phone.
      let phoneToAssign = rawPhone || null;
      if (phoneToAssign) {
        const phoneOwner = await this.prisma.person.findFirst({
          where: { churchId, phone: phoneToAssign },
          select: { id: true },
        });
        if (phoneOwner) {
          phoneToAssign = null;
        }
      }

      try {
        person = await this.prisma.person.create({
          data: {
            churchId,
            firstName: 'New',
            lastName: 'Visitor',
            email: submittedEmail,
            phone: phoneToAssign,
            membershipStatus: MembershipStatus.VISITOR,
            namesConfirmed: false,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          person = await this.prisma.person.create({
            data: {
              churchId,
              firstName: 'New',
              lastName: 'Visitor',
              email: submittedEmail,
              phone: null,
              membershipStatus: MembershipStatus.VISITOR,
              namesConfirmed: false,
            },
          });
        } else {
          throw err;
        }
      }
    }

    // Unknown phone without matching person: silent 200 (no account creation).
    if (!person) {
      return { message: CLAIM_RESPONSE_MESSAGE };
    }

    const recipientEmail = person.email?.trim().toLowerCase();
    if (!recipientEmail) {
      // Person exists by phone but has no email: cannot deliver magic link.
      return { message: CLAIM_RESPONSE_MESSAGE };
    }

    // Per-email rate limit: 1 per 60 s, 5 per hour.
    if (!this.claimRateLimiter.tryConsume(recipientEmail)) {
      return { message: CLAIM_RESPONSE_MESSAGE };
    }

    // Issue a 32-byte hex (64 char) single-use magic link token.
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

    const appUrl =
      this.configService.get<string>('appUrl')?.replace(/\/+$/, '') ||
      'http://localhost:3000';
    const profileBaseUrl =
      this.configService.get<string>('profileUrl')?.replace(/\/+$/, '') ||
      `${appUrl}/profile`;
    const profileLinkUrl = `${profileBaseUrl}/${token}`;
    const churchShortName =
      church?.shortName?.trim() || church?.name || 'Your Church';
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
        churchName: church?.name || 'Your Church',
        contactEmail: church?.email || undefined,
        contactPhone: church?.phone || undefined,
        churchId: church?.id || churchId,
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
   * Validates a profile magic link token. On the first open, records
   * profileTokenOpenedAt so the user is given a grace period to complete the form.
   */
  async getByToken(token: string) {
    const person = await this.prisma.person.findUnique({
      where: { profileToken: token },
      include: TOKEN_PERSON_INCLUDE,
    });

    if (!person) {
      throw linkError(
        'This link is invalid or has already been used. Please request a new one.',
        'PROFILE_LINK_INVALID',
      );
    }

    const now = new Date();
    if (person.profileTokenExpiresAt && person.profileTokenExpiresAt < now) {
      throw linkError(
        'This link has expired. Links are valid for 30 minutes. Please request a new one.',
        'PROFILE_LINK_EXPIRED',
      );
    }

    if (!person.profileTokenOpenedAt) {
      await this.prisma.person.update({
        where: { id: person.id },
        data: { profileTokenOpenedAt: now },
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
      availableDepartments: availableDepartments.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
      })),
    };
  }

  /**
   * Saves profile edits submitted via magic link and consumes the token.
   * If a PIN is set or exists after save, returns an accessToken.
   */
  async updateByToken(token: string, dto: UpdateProfileDto) {
    const person = await this.prisma.person.findUnique({
      where: { profileToken: token },
      include: { departmentMemberships: true },
    });

    if (!person) {
      throw linkError(
        'This link is invalid or has already been used. Please request a new one.',
        'PROFILE_LINK_INVALID',
      );
    }

    const now = Date.now();
    const expiresAtMs = person.profileTokenExpiresAt?.getTime() ?? 0;
    const openedAtMs = person.profileTokenOpenedAt?.getTime() ?? 0;

    const unexpired = expiresAtMs > now;
    const openedGraceActive =
      openedAtMs > 0 &&
      openedAtMs <= expiresAtMs &&
      now - openedAtMs < PROFILE_SAVE_GRACE_MS;

    if (!unexpired && !openedGraceActive) {
      throw linkError(
        'This link has expired. Links are valid for 30 minutes. Please request a new one.',
        'PROFILE_LINK_EXPIRED',
      );
    }

    // Name completeness guard for placeholder visitors
    if (!person.namesConfirmed) {
      const effectiveFirstName = dto.firstName ?? person.firstName;
      const effectiveLastName = dto.lastName ?? person.lastName;
      const isPlaceholder =
        effectiveFirstName === 'New' && effectiveLastName === 'Visitor';
      const isMissing =
        !effectiveFirstName?.trim() || !effectiveLastName?.trim();

      if (isPlaceholder || isMissing) {
        throw new BadRequestException({
          message: 'First and last name are required to set up your profile',
          code: 'NAMES_REQUIRED',
        });
      }
    }

    const effectiveStatus = dto.membershipStatus ?? person.membershipStatus;
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
      profileToken: null,
      profileTokenExpiresAt: null,
      profileTokenOpenedAt: null,
      namesConfirmed: true,
    };

    if (firstName !== undefined) personUpdateData.firstName = firstName.trim();
    if (lastName !== undefined) personUpdateData.lastName = lastName.trim();

    if (email !== undefined) {
      const targetEmail = email?.trim().toLowerCase() || null;
      personUpdateData.email = targetEmail;
      if (targetEmail && targetEmail !== person.email) {
        const emailConflict = await this.prisma.person.findFirst({
          where: {
            churchId: person.churchId,
            email: targetEmail,
            id: { not: person.id },
          },
          select: { id: true },
        });
        if (emailConflict) {
          throw new ConflictException({
            message: CONTACT_ALREADY_REGISTERED_MESSAGE,
            code: CONTACT_ALREADY_REGISTERED_CODE,
          });
        }
      }
    }

    if (phone !== undefined) {
      const targetPhone = normalizePhoneOrThrow(phone);
      personUpdateData.phone = targetPhone;
      if (targetPhone && targetPhone !== person.phone) {
        const phoneConflict = await this.prisma.person.findFirst({
          where: {
            churchId: person.churchId,
            phone: targetPhone,
            id: { not: person.id },
          },
          select: { id: true },
        });
        if (phoneConflict) {
          throw new ConflictException({
            message: CONTACT_ALREADY_REGISTERED_MESSAGE,
            code: CONTACT_ALREADY_REGISTERED_CODE,
          });
        }
      }
    }

    if (gender !== undefined) personUpdateData.gender = gender;
    if (address !== undefined)
      personUpdateData.address = address?.trim() || null;
    if (membershipStatus !== undefined)
      personUpdateData.membershipStatus = membershipStatus;
    if (dateOfBirth !== undefined) {
      personUpdateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }
    if (dto.pin) {
      validatePinStrength(dto.pin);
      personUpdateData.pinHash = await bcrypt.hash(dto.pin, 10);
      personUpdateData.pinFailedAttempts = 0;
      personUpdateData.pinLockedUntil = null;
    }

    // Transaction to update Person and Department Memberships atomically
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedPerson = await tx.person.update({
          where: { id: person.id },
          data: personUpdateData,
        });

        if (departmentIds !== undefined) {
          await tx.departmentMembership.deleteMany({
            where: {
              personId: person.id,
              departmentId: { notIn: departmentIds },
            },
          });

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

        const response: {
          message: string;
          person: ReturnType<typeof this.formatPerson>;
          accessToken?: string;
        } = {
          message: 'Profile updated successfully',
          person: this.formatPerson(updatedPerson, freshDepartments),
        };

        if (updatedPerson.pinHash) {
          response.accessToken = await this.generateMemberToken(updatedPerson);
        }

        return response;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
      throw error;
    }
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

      // Match alternative domestic Nigerian formats (0803... vs +234803...) if not found under normalized E.164
      if (!person) {
        const phoneCandidates = getPhoneCandidates(rawIdentifier).filter(
          (c) => c !== phone,
        );
        if (phoneCandidates.length > 0) {
          person = await this.prisma.person.findFirst({
            where: {
              churchId,
              phone: { in: phoneCandidates },
            },
            include: TOKEN_PERSON_INCLUDE,
          });
        }
      }
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
      const lockedUntilDate = new Date(Date.now() + lockDurationMs);

      await this.prisma.person.update({
        where: { id: person.id },
        data: {
          pinFailedAttempts: isNowLocked ? 0 : attempts,
          pinLockedUntil: isNowLocked ? lockedUntilDate : null,
        },
      });

      if (isNowLocked) {
        throw new ForbiddenException({
          message:
            'Too many incorrect PIN attempts. Your account has been temporarily locked for 15 minutes. You can also sign in via magic link.',
          code: 'PIN_LOCKED',
          lockedUntil: lockedUntilDate.toISOString(),
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
    const accessToken = await this.generateMemberToken(person);

    return {
      message: 'Login successful',
      accessToken,
      person: this.formatPerson(person, person.departmentMemberships),
      church: person.church,
    };
  }

  /**
   * Retrieves authenticated member's profile and church context.
   * Generates a renewed accessToken to maintain sliding session.
   */
  async getMe(personId: string) {
    const person = await this.prisma.person.findUnique({
      where: { id: personId },
      include: TOKEN_PERSON_INCLUDE,
    });

    if (!person) {
      throw new UnauthorizedException('Member not found');
    }

    const accessToken = await this.generateMemberToken(person);

    return {
      person: this.formatPerson(person, person.departmentMemberships),
      church: person.church,
      accessToken,
    };
  }

  /**
   * Sets or changes the member's 4-digit PIN.
   * If person.hasPin is true, currentPin is required and validated against lockout rules.
   * Weak PINs are rejected with 400 PIN_TOO_WEAK.
   */
  async changePin(personId: string, dto: ChangePinDto) {
    validatePinStrength(dto.newPin);

    const person = await this.prisma.person.findUnique({
      where: { id: personId },
    });

    if (!person) {
      throw new UnauthorizedException('Member not found');
    }

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

    if (person.pinHash) {
      if (!dto.currentPin) {
        throw new BadRequestException({
          message: 'Current PIN is required to change your PIN',
          code: 'CURRENT_PIN_REQUIRED',
        });
      }

      const isMatch = await bcrypt.compare(dto.currentPin, person.pinHash);
      if (!isMatch) {
        const attempts = person.pinFailedAttempts + 1;
        const maxAttempts = 5;
        const isNowLocked = attempts >= maxAttempts;
        const lockDurationMs = 15 * 60 * 1000;
        const lockedUntilDate = new Date(Date.now() + lockDurationMs);

        await this.prisma.person.update({
          where: { id: person.id },
          data: {
            pinFailedAttempts: isNowLocked ? 0 : attempts,
            pinLockedUntil: isNowLocked ? lockedUntilDate : null,
          },
        });

        if (isNowLocked) {
          throw new ForbiddenException({
            message:
              'Too many incorrect PIN attempts. Your account has been temporarily locked for 15 minutes. You can also sign in via magic link.',
            code: 'PIN_LOCKED',
            lockedUntil: lockedUntilDate.toISOString(),
          });
        }

        throw new UnauthorizedException({
          message: `Incorrect PIN. ${maxAttempts - attempts} attempt(s) remaining.`,
          code: 'INVALID_PIN',
          attemptsRemaining: maxAttempts - attempts,
        });
      }
    }

    const pinHash = await bcrypt.hash(dto.newPin, 10);
    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        pinHash,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
      },
    });

    return {
      message: 'PIN updated successfully',
    };
  }

  /**
   * Revokes the current member session.
   */
  logout(
    payload: MemberJwtPayload,
    rawToken?: string,
  ): Promise<{ message: string }> {
    const expMs = payload.exp
      ? payload.exp * 1000
      : Date.now() + 30 * 24 * 60 * 60 * 1000;

    if (payload.jti) {
      this.memberSessionService.revoke(payload.jti, expMs);
    }
    if (rawToken) {
      this.memberSessionService.revoke(rawToken, expMs);
    }

    return Promise.resolve({
      message: 'Logged out successfully',
    });
  }

  /**
   * Adds a new relative: creates a Person record (as an un-claimed visitor)
   * and links them to the signed-in member in a single transaction.
   */
  async addRelative(
    memberId: string,
    churchId: string,
    dto: CreateRelativeDto,
  ) {
    if (!this.relativeRateLimiter.tryConsumeAdd(memberId)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Daily limit for adding relatives reached. Please try again tomorrow.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const normalizedEmail =
      dto.email !== undefined ? dto.email?.trim().toLowerCase() || null : null;
    const normalizedPhone =
      dto.phone !== undefined ? normalizePhoneOrThrow(dto.phone) : null;

    if (!normalizedEmail && !normalizedPhone) {
      throw new BadRequestException({
        message: CONTACT_REQUIRED_MESSAGE,
        code: CONTACT_REQUIRED_CODE,
      });
    }

    if (normalizedEmail) {
      const existingEmail = await this.prisma.person.findFirst({
        where: { churchId, email: normalizedEmail },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
    }

    if (normalizedPhone) {
      const existingPhone = await this.prisma.person.findFirst({
        where: { churchId, phone: normalizedPhone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const newPerson = await tx.person.create({
          data: {
            churchId,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            gender: dto.gender || null,
            dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
            membershipStatus: MembershipStatus.VISITOR,
            namesConfirmed: true,
          },
        });

        const rel = await tx.personRelationship.create({
          data: {
            churchId,
            personId: memberId,
            relatedPersonId: newPerson.id,
            type: dto.relationship,
            note: dto.relationshipNote?.trim() || null,
            createdByPersonId: memberId,
          },
        });

        return {
          relationshipId: rel.id,
          person: {
            id: newPerson.id,
            firstName: newPerson.firstName,
            lastName: newPerson.lastName,
          },
          relationship: rel.type,
          relationshipNote: rel.note,
          addedByMe: true,
          claimed: false,
          maskedEmail: maskEmail(newPerson.email),
          maskedPhone: maskPhone(newPerson.phone),
          canSendClaimLink: Boolean(newPerson.phone),
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: CONTACT_ALREADY_REGISTERED_MESSAGE,
          code: CONTACT_ALREADY_REGISTERED_CODE,
        });
      }
      throw error;
    }
  }

  /**
   * Lists relatives linked to the signed-in member (both incoming and outgoing).
   */
  async listMyRelatives(memberId: string, churchId: string) {
    const relationships = await this.prisma.personRelationship.findMany({
      where: {
        churchId,
        OR: [{ personId: memberId }, { relatedPersonId: memberId }],
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pinHash: true,
          },
        },
        relatedPerson: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pinHash: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = relationships.map((rel) => {
      const isFromMe = rel.personId === memberId;
      const targetPerson = isFromMe ? rel.relatedPerson : rel.person;
      const relType = isFromMe
        ? rel.type
        : getInverseRelationshipType(rel.type);
      const addedByMe = rel.createdByPersonId === memberId;
      const claimed = Boolean(targetPerson.pinHash);
      const canSendClaimLink = Boolean(
        addedByMe && !claimed && targetPerson.phone,
      );

      return {
        relationshipId: rel.id,
        person: {
          id: targetPerson.id,
          firstName: targetPerson.firstName,
          lastName: targetPerson.lastName,
        },
        relationship: relType,
        relationshipNote: rel.note,
        addedByMe,
        claimed,
        maskedEmail: maskEmail(targetPerson.email),
        maskedPhone: maskPhone(targetPerson.phone),
        canSendClaimLink,
      };
    });

    return { items };
  }

  /**
   * Deletes a relationship link. Allowed for either party in the relationship.
   */
  async deleteMyRelative(
    memberId: string,
    churchId: string,
    relationshipId: string,
  ) {
    const rel = await this.prisma.personRelationship.findUnique({
      where: { id: relationshipId },
    });

    if (!rel || rel.churchId !== churchId) {
      throw new NotFoundException('Relationship not found');
    }

    if (rel.personId !== memberId && rel.relatedPersonId !== memberId) {
      throw new ForbiddenException(
        'You do not have permission to remove this relationship',
      );
    }

    await this.prisma.personRelationship.delete({
      where: { id: relationshipId },
    });

    return { message: 'Relationship removed successfully' };
  }

  /**
   * Generates a 48-hour claim link for an unclaimed relative created by the member.
   */
  async createRelativeClaimLink(
    memberId: string,
    churchId: string,
    personId: string,
  ) {
    const person = await this.prisma.person.findFirst({
      where: { id: personId, churchId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        pinHash: true,
      },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${personId}" not found`);
    }

    // Allowed only if the member created this person
    const link = await this.prisma.personRelationship.findFirst({
      where: {
        churchId,
        createdByPersonId: memberId,
        OR: [
          { personId: memberId, relatedPersonId: personId },
          { personId: personId, relatedPersonId: memberId },
        ],
      },
    });

    if (!link) {
      throw new ForbiddenException({
        message:
          'Only the member who created this profile can request a claim link',
        code: 'NOT_CREATOR',
      });
    }

    if (person.pinHash) {
      throw new ConflictException({
        message: 'This profile has already been claimed',
        code: 'ALREADY_CLAIMED',
      });
    }

    if (!person.phone) {
      throw new ConflictException({
        message: 'This person does not have a phone number',
        code: 'NO_PHONE',
      });
    }

    if (!this.relativeRateLimiter.tryConsumeClaimLink(personId)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Claim link requests are limited to 3 per day for this person',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + PROFILE_WHATSAPP_LINK_TTL_MS);

    await this.prisma.person.update({
      where: { id: person.id },
      data: {
        profileToken: token,
        profileTokenExpiresAt: expiresAt,
        profileTokenOpenedAt: null,
      },
    });

    const appUrl =
      this.configService.get<string>('appUrl')?.replace(/\/+$/, '') ||
      'http://localhost:3000';
    const profileBaseUrl =
      this.configService.get<string>('profileUrl')?.replace(/\/+$/, '') ||
      `${appUrl}/profile`;
    const url = `${profileBaseUrl}/${token}`;

    const [sender, church] = await Promise.all([
      this.prisma.person.findUnique({
        where: { id: memberId },
        select: { firstName: true },
      }),
      this.prisma.church.findUnique({
        where: { id: churchId },
        select: { name: true, shortName: true },
      }),
    ]);

    const senderName = sender?.firstName || 'your relative';
    const churchName =
      church?.shortName?.trim() || church?.name || 'our church';

    const messageText = `Hi ${person.firstName}, it's ${senderName}. I've added you to ${churchName} so we're all connected. Open this link to set up your profile: ${url}`;
    const digits = toWhatsAppDigits(person.phone);
    const whatsappUrl = `https://wa.me/${digits}?text=${encodeURIComponent(messageText)}`;

    return {
      url,
      whatsappUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
