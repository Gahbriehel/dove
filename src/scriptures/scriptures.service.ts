import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Scripture,
  ScriptureKind,
  ScriptureStatus,
} from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScriptureDto } from './dto/create-scripture.dto';
import { QueryScripturesDto } from './dto/query-scriptures.dto';
import { UpdateScriptureDto } from './dto/update-scripture.dto';
import {
  formatDateOnly,
  getTodayInLagos,
  parseDateOnly,
} from './utils/scripture.util';

export interface PublicScriptureDto {
  id: string;
  kind: ScriptureKind;
  text: string;
  reference: string;
  translation: string | null;
  givenBy: string | null;
  startsOn: string;
}

export interface AdminScriptureItemDto extends PublicScriptureDto {
  status: ScriptureStatus;
  createdAt: Date;
  updatedAt: Date;
  isCurrent: boolean;
}

@Injectable()
export class ScripturesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public endpoint to get current week and year scriptures.
   */
  async getCurrentScriptures(
    churchIdQuery?: string,
    user?: ActiveUserData,
  ): Promise<{
    week: PublicScriptureDto | null;
    year: PublicScriptureDto | null;
  }> {
    const targetChurchId =
      churchIdQuery ||
      user?.churchId ||
      (await this.prisma.getDefaultChurchId());

    const church = await this.prisma.church.findUnique({
      where: { id: targetChurchId },
    });
    if (!church) {
      throw new NotFoundException(
        `Church with ID "${targetChurchId}" not found`,
      );
    }

    const todayDate = parseDateOnly(getTodayInLagos());

    const [week, year] = await Promise.all([
      this.prisma.scripture.findFirst({
        where: {
          churchId: targetChurchId,
          kind: ScriptureKind.WEEK,
          status: ScriptureStatus.PUBLISHED,
          startsOn: { lte: todayDate },
        },
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.scripture.findFirst({
        where: {
          churchId: targetChurchId,
          kind: ScriptureKind.YEAR,
          status: ScriptureStatus.PUBLISHED,
          startsOn: { lte: todayDate },
        },
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      week: this.formatPublicItem(week),
      year: this.formatPublicItem(year),
    };
  }

  /**
   * List scriptures for admin staff with filters and pagination.
   */
  async findAll(
    query: QueryScripturesDto,
    user: ActiveUserData,
  ): Promise<{
    items: AdminScriptureItemDto[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const churchId = user.churchId;

    const where: Prisma.ScriptureWhereInput = {
      churchId,
    };
    if (query.kind) {
      where.kind = query.kind;
    }
    if (query.status) {
      where.status = query.status;
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const todayDate = parseDateOnly(getTodayInLagos());

    // Find live scriptures to mark isCurrent
    const [currentWeek, currentYear] = await Promise.all([
      this.prisma.scripture.findFirst({
        where: {
          churchId,
          kind: ScriptureKind.WEEK,
          status: ScriptureStatus.PUBLISHED,
          startsOn: { lte: todayDate },
        },
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      }),
      this.prisma.scripture.findFirst({
        where: {
          churchId,
          kind: ScriptureKind.YEAR,
          status: ScriptureStatus.PUBLISHED,
          startsOn: { lte: todayDate },
        },
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
        select: { id: true },
      }),
    ]);

    const currentIds = new Set(
      [currentWeek?.id, currentYear?.id].filter((id): id is string =>
        Boolean(id),
      ),
    );

    const [items, total] = await Promise.all([
      this.prisma.scripture.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.scripture.count({ where }),
    ]);

    const formattedItems: AdminScriptureItemDto[] = items.map((item) => ({
      id: item.id,
      kind: item.kind,
      text: item.text,
      reference: item.reference,
      translation: item.translation ?? null,
      givenBy: item.givenBy ?? null,
      startsOn: formatDateOnly(item.startsOn),
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      isCurrent: currentIds.has(item.id),
    }));

    return {
      items: formattedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Create a new scripture record (defaults to today Lagos if startsOn omitted).
   */
  async create(dto: CreateScriptureDto, user: ActiveUserData) {
    const churchId = user.churchId;

    const church = await this.prisma.church.findUnique({
      where: { id: churchId },
    });
    if (!church) {
      throw new NotFoundException(`Church with ID "${churchId}" not found`);
    }

    const status = dto.status ?? ScriptureStatus.DRAFT;
    if (status === ScriptureStatus.PUBLISHED) {
      if (!dto.text?.trim() || !dto.reference?.trim()) {
        throw new BadRequestException(
          'Publishing requires non-empty text and reference',
        );
      }
    }

    const startsOnDateStr = dto.startsOn ?? getTodayInLagos();
    const startsOnDate = parseDateOnly(startsOnDateStr);

    const created = await this.prisma.scripture.create({
      data: {
        churchId,
        kind: dto.kind,
        text: dto.text,
        reference: dto.reference,
        translation: dto.translation ?? null,
        givenBy: dto.givenBy ?? null,
        startsOn: startsOnDate,
        status,
        createdById: user.sub,
        updatedById: user.sub,
      },
    });

    return {
      id: created.id,
      kind: created.kind,
      text: created.text,
      reference: created.reference,
      translation: created.translation ?? null,
      givenBy: created.givenBy ?? null,
      startsOn: formatDateOnly(created.startsOn),
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Update scripture record with validation on merged status.
   */
  async update(id: string, dto: UpdateScriptureDto, user: ActiveUserData) {
    const existing = await this.prisma.scripture.findUnique({
      where: { id },
    });

    if (!existing || existing.churchId !== user.churchId) {
      throw new NotFoundException('Scripture not found');
    }

    const targetStatus = dto.status ?? existing.status;
    const targetText = dto.text !== undefined ? dto.text : existing.text;
    const targetReference =
      dto.reference !== undefined ? dto.reference : existing.reference;

    if (targetStatus === ScriptureStatus.PUBLISHED) {
      if (!targetText?.trim() || !targetReference?.trim()) {
        throw new BadRequestException(
          'Publishing requires non-empty text and reference',
        );
      }
    }

    const data: Prisma.ScriptureUpdateInput = {
      updatedById: user.sub,
    };

    if (dto.text !== undefined) data.text = dto.text;
    if (dto.reference !== undefined) data.reference = dto.reference;
    if (dto.translation !== undefined)
      data.translation = dto.translation ?? null;
    if (dto.givenBy !== undefined) data.givenBy = dto.givenBy ?? null;
    if (dto.startsOn !== undefined) data.startsOn = parseDateOnly(dto.startsOn);
    if (dto.status !== undefined) data.status = dto.status;

    const updated = await this.prisma.scripture.update({
      where: { id },
      data,
    });

    return {
      id: updated.id,
      kind: updated.kind,
      text: updated.text,
      reference: updated.reference,
      translation: updated.translation ?? null,
      givenBy: updated.givenBy ?? null,
      startsOn: formatDateOnly(updated.startsOn),
      status: updated.status,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Hard delete scripture record.
   */
  async remove(id: string, user: ActiveUserData): Promise<{ message: string }> {
    const existing = await this.prisma.scripture.findUnique({
      where: { id },
    });

    if (!existing || existing.churchId !== user.churchId) {
      throw new NotFoundException('Scripture not found');
    }

    await this.prisma.scripture.delete({
      where: { id },
    });

    return {
      message: 'Scripture deleted successfully',
    };
  }

  /**
   * Helper to format public representation without sensitive or audit fields.
   */
  private formatPublicItem(item: Scripture | null): PublicScriptureDto | null {
    if (!item) return null;
    return {
      id: item.id,
      kind: item.kind,
      text: item.text,
      reference: item.reference,
      translation: item.translation ?? null,
      givenBy: item.givenBy ?? null,
      startsOn: formatDateOnly(item.startsOn),
    };
  }
}
