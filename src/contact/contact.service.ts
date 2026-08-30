import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
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
}
