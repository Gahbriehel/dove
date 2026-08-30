import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import { QueryContactSubmissionDto } from './dto/query-contact-submission.dto';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import * as crypto from 'crypto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  private readonly permittedPrayerCategories = [
    'Healing & Health',
    'Family & Marriage',
    'Financial Breakthrough',
    'Spiritual Growth',
    'General Prayer',
  ];

  private readonly permittedInquiryCategories = [
    'Visiting This Sunday',
    'Small Groups / Ministries',
    'Volunteering',
    'General Question',
  ];

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactSubmissionDto, tenantSlug?: string) {
    const { type, name, email, phone, category, message, isPrivate } = dto;

    // 1. Tenancy Resolution
    let churchId: string;
    if (tenantSlug) {
      const church = await this.prisma.church.findUnique({
        where: { slug: tenantSlug },
      });
      if (!church) {
        throw new NotFoundException(
          `Church with slug/key "${tenantSlug}" not found`,
        );
      }
      churchId = church.id;
    } else {
      churchId = await this.prisma.getDefaultChurchId();
    }

    // 2. Category Validation
    if (type === 'prayer') {
      if (!this.permittedPrayerCategories.includes(category)) {
        throw new BadRequestException(
          `For type "prayer", category must be one of: ${this.permittedPrayerCategories.join(', ')}`,
        );
      }
    } else if (type === 'inquiry') {
      if (!this.permittedInquiryCategories.includes(category)) {
        throw new BadRequestException(
          `For type "inquiry", category must be one of: ${this.permittedInquiryCategories.join(', ')}`,
        );
      }
    }

    // 3. Field Normalization
    const isPrivateValue = type === 'prayer' ? (isPrivate ?? false) : false;

    // 4. Custom ID Generation (contact_abc123xyz format)
    const randomHex = crypto.randomBytes(6).toString('hex'); // 12 characters
    const contactId = `contact_${randomHex}`;

    // 5. Persistence
    return this.prisma.contactSubmission.create({
      data: {
        id: contactId,
        churchId,
        type,
        name,
        email,
        phone: phone || null,
        category,
        message,
        isPrivate: isPrivateValue,
      },
    });
  }

  async findAll(query: QueryContactSubmissionDto, user: ActiveUserData) {
    const { type, category, search, churchId, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');

    const where: Prisma.ContactSubmissionWhereInput = {};

    if (isSuperAdmin) {
      if (churchId) {
        where.churchId = churchId;
      }
    } else {
      where.churchId = user.churchId;
    }

    if (type) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { message: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.contactSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactSubmission.count({ where }),
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

  async findOne(id: string, user: ActiveUserData) {
    const isSuperAdmin = user.roles.includes('SUPER_ADMIN');

    const submission = await this.prisma.contactSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(
        `Contact submission with ID "${id}" not found`,
      );
    }

    if (!isSuperAdmin && submission.churchId !== user.churchId) {
      throw new NotFoundException(
        `Contact submission with ID "${id}" not found`,
      );
    }

    return submission;
  }
}
