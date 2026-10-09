import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL_SERVICE } from '../email/interfaces/email-service.interface';
import type { IEmailService } from '../email/interfaces/email-service.interface';
import { SendBirthdayGreetingDto } from './dto/send-birthday-greeting.dto';
import {
  BirthdayStatusFilter,
  QueryBirthdayDto,
} from './dto/query-birthday.dto';
import {
  BirthdayAnalyticsResponseDto,
  MonthlyBirthdayStatDto,
  QueryBirthdayAnalyticsDto,
} from './dto/birthday-analytics.dto';
import {
  BirthdayListResponseDto,
  BirthdayPersonItemDto,
} from './dto/birthday-response.dto';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class BirthdaysService {
  private readonly logger = new Logger(BirthdaysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_SERVICE)
    private readonly emailProvider: IEmailService,
  ) {}

  /**
   * Sends a birthday greeting email to an individual member.
   * Atomic operation with DB-level concurrency and duplicate protection.
   */
  async sendBirthdayGreeting(
    dto: SendBirthdayGreetingDto,
    userId: string,
    userChurchId?: string,
  ) {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());

    const person = await this.prisma.person.findFirst({
      where: { id: dto.personId, churchId },
      include: { church: true },
    });

    if (!person) {
      throw new NotFoundException(`Person with ID "${dto.personId}" not found`);
    }

    if (!person.dateOfBirth) {
      throw new BadRequestException(
        `Person "${person.firstName} ${person.lastName}" does not have a date of birth recorded.`,
      );
    }

    if (!person.email || person.email.trim() === '') {
      throw new BadRequestException(
        `Person "${person.firstName} ${person.lastName}" does not have a valid email address.`,
      );
    }

    const now = new Date();
    const todayUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const dob = new Date(person.dateOfBirth);
    const birthMonth = dob.getUTCMonth();
    const birthDate = dob.getUTCDate();
    const currentCalendarYear = todayUtcMidnight.getUTCFullYear();

    let targetYear = dto.year;
    if (!targetYear) {
      const thisYearBirthday = new Date(
        Date.UTC(currentCalendarYear, birthMonth, birthDate),
      );
      if (thisYearBirthday.getTime() >= todayUtcMidnight.getTime()) {
        targetYear = currentCalendarYear;
      } else {
        const existingGreetingCurrentYear =
          await this.prisma.birthdayGreeting.findUnique({
            where: {
              unique_person_year_greeting: {
                personId: person.id,
                year: currentCalendarYear,
              },
            },
          });
        targetYear = existingGreetingCurrentYear
          ? currentCalendarYear + 1
          : currentCalendarYear;
      }
    }

    // Check for existing greeting record before attempting creation
    const existingGreeting = await this.prisma.birthdayGreeting.findUnique({
      where: {
        unique_person_year_greeting: {
          personId: person.id,
          year: targetYear,
        },
      },
      include: {
        sentBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (existingGreeting) {
      const sentByName =
        `${existingGreeting.sentBy.firstName} ${existingGreeting.sentBy.lastName}`.trim();
      throw new ConflictException(
        `Birthday greeting for ${person.firstName} ${person.lastName} (${targetYear}) was already sent by ${sentByName} on ${existingGreeting.createdAt.toISOString()}`,
      );
    }

    const turningAge = targetYear - dob.getUTCFullYear();
    const vars: Record<string, string> = {
      firstName: person.firstName,
      lastName: person.lastName,
      fullName: `${person.firstName} ${person.lastName}`,
      email: person.email,
      churchName: person.church?.name || '',
      turningAge: String(turningAge),
      age: String(turningAge),
      year: String(targetYear),
    };

    const resolvedImageUrl = this.resolveImageUrl(dto.imageUrl);
    const subject = this.replacePlaceholders(dto.subject, vars);
    const heading = dto.heading
      ? this.replacePlaceholders(dto.heading, vars)
      : undefined;
    const message = this.replacePlaceholders(dto.message, vars);
    const ctaLabel = dto.ctaLabel
      ? this.replacePlaceholders(dto.ctaLabel, vars)
      : undefined;
    const ctaUrl = dto.ctaUrl
      ? this.replacePlaceholders(dto.ctaUrl, vars)
      : undefined;

    let greetingRecord;
    try {
      greetingRecord = await this.prisma.birthdayGreeting.create({
        data: {
          churchId,
          personId: person.id,
          sentByUserId: userId,
          year: targetYear,
          subject,
          heading,
          message,
          imageUrl: resolvedImageUrl,
          ctaLabel,
          ctaUrl,
        },
        include: {
          sentBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const latest = await this.prisma.birthdayGreeting.findUnique({
          where: {
            unique_person_year_greeting: {
              personId: person.id,
              year: targetYear,
            },
          },
          include: {
            sentBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
        const sentByName = latest?.sentBy
          ? `${latest.sentBy.firstName} ${latest.sentBy.lastName}`.trim()
          : 'another admin';
        throw new ConflictException(
          `Birthday greeting for ${person.firstName} ${person.lastName} (${targetYear}) was already sent by ${sentByName}`,
        );
      }
      throw error;
    }

    try {
      await this.emailProvider.sendCustomBroadcast({
        recipientEmail: person.email,
        recipientName: `${person.firstName} ${person.lastName}`,
        subject,
        heading,
        message,
        ctaLabel,
        ctaUrl,
        churchName: person.church?.name,
        contactEmail: person.church?.email || undefined,
        contactPhone: person.church?.phone || undefined,
        imageUrl: resolvedImageUrl,
        emailType: 'BIRTHDAY_GREETING',
        churchId,
        personId: person.id,
        userId,
        sentByUserId: userId,
      });
    } catch (emailError) {
      this.logger.error(
        `Failed to dispatch birthday email to ${person.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
      );
      await this.prisma.birthdayGreeting
        .delete({
          where: { id: greetingRecord.id },
        })
        .catch((rollbackErr) =>
          this.logger.warn(
            `Failed to rollback birthday greeting record: ${rollbackErr}`,
          ),
        );

      throw new BadRequestException(
        `Failed to dispatch birthday email to ${person.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`,
      );
    }

    return {
      message: `Birthday greeting successfully sent to ${person.firstName} ${person.lastName}`,
      greeting: {
        id: greetingRecord.id,
        year: greetingRecord.year,
        subject: greetingRecord.subject,
        heading: greetingRecord.heading,
        message: greetingRecord.message,
        imageUrl: greetingRecord.imageUrl,
        ctaLabel: greetingRecord.ctaLabel,
        ctaUrl: greetingRecord.ctaUrl,
        sentAt: greetingRecord.createdAt,
        sentBy: {
          id: greetingRecord.sentBy.id,
          firstName: greetingRecord.sentBy.firstName,
          lastName: greetingRecord.sentBy.lastName,
          email: greetingRecord.sentBy.email,
        },
      },
    };
  }

  /**
   * Retrieves list of birthdays with current greeting status, sender details, and filters.
   */
  async getBirthdays(
    query: QueryBirthdayDto,
    userChurchId?: string,
  ): Promise<BirthdayListResponseDto> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const now = new Date();
    const todayUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const targetYear = query.year || todayUtcMidnight.getUTCFullYear();

    const [people, greetings] = await Promise.all([
      this.prisma.person.findMany({
        where: {
          churchId,
          dateOfBirth: { not: null },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          membershipStatus: true,
          dateOfBirth: true,
        },
      }),
      this.prisma.birthdayGreeting.findMany({
        where: {
          churchId,
          year: targetYear,
        },
        include: {
          sentBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    const greetingsMap = new Map<string, (typeof greetings)[0]>();
    for (const g of greetings) {
      greetingsMap.set(g.personId, g);
    }

    const items: BirthdayPersonItemDto[] = [];

    for (const p of people) {
      const dob = new Date(p.dateOfBirth!);
      const birthMonth = dob.getUTCMonth() + 1;
      const birthDate = dob.getUTCDate();

      if (query.month && birthMonth !== query.month) {
        continue;
      }

      if (query.search && query.search.trim() !== '') {
        const s = query.search.toLowerCase().trim();
        const matchesName =
          p.firstName.toLowerCase().includes(s) ||
          p.lastName.toLowerCase().includes(s) ||
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(s);
        const matchesEmail = p.email
          ? p.email.toLowerCase().includes(s)
          : false;
        const matchesPhone = p.phone
          ? p.phone.toLowerCase().includes(s)
          : false;
        if (!matchesName && !matchesEmail && !matchesPhone) {
          continue;
        }
      }

      const birthdayDate = new Date(
        Date.UTC(targetYear, dob.getUTCMonth(), birthDate),
      );
      const diffMs = birthdayDate.getTime() - todayUtcMidnight.getTime();
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
      const turningAge = targetYear - dob.getUTCFullYear();

      const greetingRecord = greetingsMap.get(p.id);
      const isGreeted = !!greetingRecord;

      let status: BirthdayStatusFilter;
      if (isGreeted) {
        status = BirthdayStatusFilter.COMPLETED;
      } else if (birthdayDate.getTime() < todayUtcMidnight.getTime()) {
        status = BirthdayStatusFilter.MISSED;
      } else {
        status = BirthdayStatusFilter.PENDING;
      }

      if (
        query.status &&
        query.status !== BirthdayStatusFilter.ALL &&
        status !== query.status
      ) {
        continue;
      }

      items.push({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        membershipStatus: p.membershipStatus,
        dateOfBirth: p.dateOfBirth!,
        birthdayDate,
        daysUntil,
        turningAge,
        status,
        isGreeted,
        greeting: greetingRecord
          ? {
              id: greetingRecord.id,
              year: greetingRecord.year,
              subject: greetingRecord.subject,
              heading: greetingRecord.heading,
              message: greetingRecord.message,
              imageUrl: greetingRecord.imageUrl,
              ctaLabel: greetingRecord.ctaLabel,
              ctaUrl: greetingRecord.ctaUrl,
              sentAt: greetingRecord.createdAt,
              sentBy: {
                id: greetingRecord.sentBy.id,
                firstName: greetingRecord.sentBy.firstName,
                lastName: greetingRecord.sentBy.lastName,
                email: greetingRecord.sentBy.email,
              },
            }
          : null,
      });
    }

    // Sort: today/upcoming first by daysUntil ascending, then past
    items.sort((a, b) => {
      if (a.daysUntil >= 0 && b.daysUntil >= 0) {
        return a.daysUntil - b.daysUntil;
      }
      if (a.daysUntil >= 0 && b.daysUntil < 0) {
        return -1;
      }
      if (a.daysUntil < 0 && b.daysUntil >= 0) {
        return 1;
      }
      return b.daysUntil - a.daysUntil;
    });

    const total = items.length;
    const page = query.page || 1;
    const limit = query.limit || 50;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = items.slice(startIndex, startIndex + limit);

    return {
      data: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Performance & Missed-vs-Handled Analytics
   */
  async getBirthdayAnalytics(
    query: QueryBirthdayAnalyticsDto,
    userChurchId?: string,
  ): Promise<BirthdayAnalyticsResponseDto> {
    const churchId = userChurchId || (await this.prisma.getDefaultChurchId());
    const now = new Date();
    const todayUtcMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const targetYear = query.year || todayUtcMidnight.getUTCFullYear();

    const [people, greetings] = await Promise.all([
      this.prisma.person.findMany({
        where: {
          churchId,
          dateOfBirth: { not: null },
        },
        select: {
          id: true,
          dateOfBirth: true,
        },
      }),
      this.prisma.birthdayGreeting.findMany({
        where: {
          churchId,
          year: targetYear,
        },
        select: {
          personId: true,
        },
      }),
    ]);

    const greetedPersonIds = new Set(greetings.map((g) => g.personId));

    const monthlyStats: Array<{
      total: number;
      completed: number;
      pending: number;
      missed: number;
    }> = Array.from({ length: 12 }, () => ({
      total: 0,
      completed: 0,
      pending: 0,
      missed: 0,
    }));

    for (const p of people) {
      const dob = new Date(p.dateOfBirth!);
      const monthIdx = dob.getUTCMonth();
      const birthDate = dob.getUTCDate();

      monthlyStats[monthIdx].total++;

      const isGreeted = greetedPersonIds.has(p.id);
      if (isGreeted) {
        monthlyStats[monthIdx].completed++;
      } else {
        const birthdayDate = new Date(
          Date.UTC(targetYear, monthIdx, birthDate),
        );
        if (birthdayDate.getTime() < todayUtcMidnight.getTime()) {
          monthlyStats[monthIdx].missed++;
        } else {
          monthlyStats[monthIdx].pending++;
        }
      }
    }

    const monthlyBreakdown: MonthlyBirthdayStatDto[] = monthlyStats.map(
      (stat, index) => {
        const handlingRate =
          stat.total > 0
            ? Number(((stat.completed / stat.total) * 100).toFixed(2))
            : 0;
        return {
          month: index + 1,
          monthName: MONTH_NAMES[index],
          total: stat.total,
          completed: stat.completed,
          pending: stat.pending,
          missed: stat.missed,
          handlingRate,
        };
      },
    );

    let totalBirthdays = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let missedCount = 0;

    if (query.month && query.month >= 1 && query.month <= 12) {
      const targetMonthStat = monthlyBreakdown[query.month - 1];
      totalBirthdays = targetMonthStat.total;
      completedCount = targetMonthStat.completed;
      pendingCount = targetMonthStat.pending;
      missedCount = targetMonthStat.missed;
    } else {
      for (const stat of monthlyStats) {
        totalBirthdays += stat.total;
        completedCount += stat.completed;
        pendingCount += stat.pending;
        missedCount += stat.missed;
      }
    }

    const handlingRate =
      totalBirthdays > 0
        ? Number(((completedCount / totalBirthdays) * 100).toFixed(2))
        : 0;

    return {
      year: targetYear,
      month: query.month,
      totalBirthdays,
      completedCount,
      pendingCount,
      missedCount,
      handlingRate,
      monthlyBreakdown,
    };
  }

  private resolveImageUrl(imageUrl?: string): string | undefined {
    if (!imageUrl || imageUrl.trim() === '') {
      return undefined;
    }
    const trimmed = imageUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    const appUrl =
      this.configService.get<string>('appUrl')?.replace(/\/+$/, '') || '';
    const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${appUrl}${normalizedPath}`;
  }

  private replacePlaceholders(
    template: string,
    vars: Record<string, string>,
  ): string {
    return template.replace(
      /\{\{(\w+)\}\}/g,
      (_match: string, key: string): string => {
        const val: string | undefined = vars[key];
        return val !== undefined ? val : `{{${key}}}`;
      },
    );
  }
}
