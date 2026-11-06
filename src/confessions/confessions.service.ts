import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Confession,
  ConfessionAudio,
  ConfessionStatus,
  ConfessionVoice,
} from '@prisma/client';
import * as crypto from 'crypto';
import { existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { writeFile } from 'fs/promises';
import { parseBuffer } from 'music-metadata';
import { extname, join } from 'path';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConfessionDto } from './dto/create-confession.dto';
import { QueryConfessionsDto } from './dto/query-confessions.dto';
import { ReorderConfessionsDto } from './dto/reorder-confessions.dto';
import { UpdateConfessionDto } from './dto/update-confession.dto';
import {
  calculateWordCount,
  generateExcerpt,
  getBodyHash,
  isUuid,
  normalizeBody,
  slugify,
} from './utils/confession.util';

export type ConfessionWithAudio = Confession & {
  audio: ConfessionAudio[];
};

export interface ConfessionAudioItem {
  url: string;
  durationSec: number;
}

export interface ConfessionListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  scriptureRef: string | null;
  category: string | null;
  status: ConfessionStatus;
  position: number | null;
  wordCount: number;
  listenCount: number;
  audio: Record<string, ConfessionAudioItem>;
  audioStale?: Record<string, boolean>;
}

export interface ConfessionDetail extends ConfessionListItem {
  body: string;
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

@Injectable()
export class ConfessionsService {
  private readonly logger = new Logger(ConfessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryConfessionsDto, user?: ActiveUserData) {
    const churchId =
      query.churchId ||
      user?.churchId ||
      (await this.prisma.getDefaultChurchId());
    const isAdmin =
      user?.roles?.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN') ?? false;

    if (!isAdmin && query.limit && query.limit > 100) {
      throw new BadRequestException(
        'Limit cannot exceed 100 for public requests',
      );
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      churchId,
    };

    if (isAdmin) {
      if (query.status) {
        where.status = query.status;
      }
    } else {
      where.status = ConfessionStatus.PUBLISHED;
    }

    if (query.category) {
      where.category = { equals: query.category.trim() };
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [{ title: { contains: term } }, { body: { contains: term } }];
    }

    // Build position lookup for all published confessions in this church
    const published = await this.prisma.confession.findMany({
      where: {
        churchId,
        status: ConfessionStatus.PUBLISHED,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const positionMap = new Map<string, number>();
    published.forEach((p, idx) => {
      positionMap.set(p.id, idx + 1);
    });

    const [items, total] = await Promise.all([
      this.prisma.confession.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { audio: true },
      }),
      this.prisma.confession.count({ where }),
    ]);

    const formattedItems = items.map((item) =>
      this.formatListItem(item, isAdmin, positionMap.get(item.id) ?? null),
    );

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

  async findCategories(churchIdQuery?: string, user?: ActiveUserData) {
    const churchId =
      churchIdQuery ||
      user?.churchId ||
      (await this.prisma.getDefaultChurchId());

    const confessions = await this.prisma.confession.findMany({
      where: {
        churchId,
        status: ConfessionStatus.PUBLISHED,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });

    const categorySet = new Set<string>();
    for (const c of confessions) {
      const cat = c.category?.trim();
      if (cat) {
        categorySet.add(cat);
      }
    }

    const sorted = Array.from(categorySet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' }),
    );

    return sorted;
  }

  async findOne(
    idOrSlug: string,
    churchIdQuery?: string,
    user?: ActiveUserData,
  ) {
    const churchId =
      churchIdQuery ||
      user?.churchId ||
      (await this.prisma.getDefaultChurchId());
    const isAdmin =
      user?.roles?.some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN') ?? false;

    const confession = isUuid(idOrSlug)
      ? await this.prisma.confession.findUnique({
          where: { id: idOrSlug },
          include: { audio: true },
        })
      : await this.prisma.confession.findUnique({
          where: { churchId_slug: { churchId, slug: idOrSlug } },
          include: { audio: true },
        });

    if (!confession || confession.churchId !== churchId) {
      throw new NotFoundException('Confession not found');
    }

    if (!isAdmin && confession.status !== ConfessionStatus.PUBLISHED) {
      throw new NotFoundException('Confession not found');
    }

    // Determine position, previous, and next relative to published confessions
    const published = await this.prisma.confession.findMany({
      where: {
        churchId,
        status: ConfessionStatus.PUBLISHED,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        sortOrder: true,
        createdAt: true,
      },
    });

    let position: number | null = null;
    let previous: { slug: string; title: string } | null = null;
    let next: { slug: string; title: string } | null = null;

    if (confession.status === ConfessionStatus.PUBLISHED) {
      const idx = published.findIndex((p) => p.id === confession.id);
      if (idx >= 0) {
        position = idx + 1;
        previous =
          idx > 0
            ? { slug: published[idx - 1].slug, title: published[idx - 1].title }
            : null;
        next =
          idx < published.length - 1
            ? { slug: published[idx + 1].slug, title: published[idx + 1].title }
            : null;
      }
    } else {
      // Draft confession viewed by admin
      position = null;
      // Preceding published confession
      const prevCandidate = [...published]
        .reverse()
        .find(
          (p) =>
            p.sortOrder < confession.sortOrder ||
            (p.sortOrder === confession.sortOrder &&
              p.createdAt < confession.createdAt),
        );
      if (prevCandidate) {
        previous = { slug: prevCandidate.slug, title: prevCandidate.title };
      }
      // Succeeding published confession
      const nextCandidate = published.find(
        (p) =>
          p.sortOrder > confession.sortOrder ||
          (p.sortOrder === confession.sortOrder &&
            p.createdAt > confession.createdAt),
      );
      if (nextCandidate) {
        next = { slug: nextCandidate.slug, title: nextCandidate.title };
      }
    }

    return this.formatFullConfession(
      confession,
      isAdmin,
      position,
      previous,
      next,
    );
  }

  async create(dto: CreateConfessionDto, user: ActiveUserData) {
    const churchId = user.churchId;
    const trimmedTitle = dto.title.trim();
    const normalizedText = normalizeBody(dto.body);

    if (dto.status === ConfessionStatus.PUBLISHED) {
      if (!trimmedTitle || !normalizedText) {
        throw new BadRequestException(
          'Publishing requires a non-empty title and body',
        );
      }
    }

    let slug: string;
    if (dto.slug) {
      const existing = await this.prisma.confession.findUnique({
        where: { churchId_slug: { churchId, slug: dto.slug } },
      });
      if (existing) {
        throw new ConflictException('Slug already in use');
      }
      slug = dto.slug;
    } else {
      const baseSlug = slugify(trimmedTitle);
      slug = await this.generateUniqueSlug(churchId, baseSlug);
    }

    let category: string | null = null;
    if (dto.category) {
      category = await this.resolveCategoryCasing(churchId, dto.category);
    }

    const scriptureRef = dto.scriptureRef?.trim() || null;

    // New confessions go to the end
    const lastConfession = await this.prisma.confession.findFirst({
      where: { churchId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = lastConfession ? lastConfession.sortOrder + 1 : 0;

    const publishedAt =
      dto.status === ConfessionStatus.PUBLISHED ? new Date() : null;

    const confession = await this.prisma.confession.create({
      data: {
        churchId,
        title: trimmedTitle,
        slug,
        body: normalizedText,
        scriptureRef,
        category,
        status: dto.status ?? ConfessionStatus.DRAFT,
        sortOrder,
        publishedAt,
        createdById: user.sub,
        updatedById: user.sub,
      },
      include: { audio: true },
    });

    return this.findOne(confession.id, churchId, user);
  }

  async update(id: string, dto: UpdateConfessionDto, user: ActiveUserData) {
    const existing = await this.prisma.confession.findUnique({
      where: { id },
      include: { audio: true },
    });

    if (!existing || existing.churchId !== user.churchId) {
      throw new NotFoundException('Confession not found');
    }

    const targetStatus = dto.status ?? existing.status;
    const targetTitle = (
      dto.title !== undefined ? dto.title : existing.title
    ).trim();
    const targetBody = (
      dto.body !== undefined ? normalizeBody(dto.body) : existing.body
    ).trim();

    if (targetStatus === ConfessionStatus.PUBLISHED) {
      if (!targetTitle || !targetBody) {
        throw new BadRequestException(
          'Publishing requires a non-empty title and body',
        );
      }
    }

    let slug = existing.slug;
    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      const conflict = await this.prisma.confession.findUnique({
        where: { churchId_slug: { churchId: user.churchId, slug: dto.slug } },
      });
      if (conflict) {
        throw new ConflictException('Slug already in use');
      }
      slug = dto.slug;
    }

    let category = existing.category;
    if (dto.category !== undefined) {
      category = dto.category
        ? await this.resolveCategoryCasing(user.churchId, dto.category)
        : null;
    }

    let scriptureRef = existing.scriptureRef;
    if (dto.scriptureRef !== undefined) {
      scriptureRef = dto.scriptureRef?.trim() || null;
    }

    let publishedAt = existing.publishedAt;
    if (targetStatus === ConfessionStatus.PUBLISHED && !publishedAt) {
      publishedAt = new Date();
    }

    await this.prisma.confession.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: targetTitle } : {}),
        ...(dto.slug !== undefined ? { slug } : {}),
        ...(dto.body !== undefined ? { body: targetBody } : {}),
        ...(dto.category !== undefined ? { category } : {}),
        ...(dto.scriptureRef !== undefined ? { scriptureRef } : {}),
        ...(dto.status !== undefined ? { status: targetStatus } : {}),
        publishedAt,
        updatedById: user.sub,
      },
    });

    return this.findOne(id, user.churchId, user);
  }

  async reorder(dto: ReorderConfessionsDto, user: ActiveUserData) {
    const churchId = user.churchId;

    if (new Set(dto.ids).size !== dto.ids.length) {
      throw new BadRequestException(
        'Duplicate confession IDs provided in reorder list',
      );
    }

    const allConfessions = await this.prisma.confession.findMany({
      where: { churchId },
      select: { id: true },
    });

    const allIdsSet = new Set(allConfessions.map((c) => c.id));

    if (dto.ids.length !== allConfessions.length) {
      throw new BadRequestException(
        'Reorder list must contain every confession ID for the church',
      );
    }

    for (const id of dto.ids) {
      if (!allIdsSet.has(id)) {
        throw new BadRequestException(
          `Unknown or invalid confession ID in reorder list: ${id}`,
        );
      }
    }

    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.confession.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    return { reordered: dto.ids.length };
  }

  async remove(id: string, user: ActiveUserData) {
    const confession = await this.prisma.confession.findUnique({
      where: { id },
    });

    if (!confession || confession.churchId !== user.churchId) {
      throw new NotFoundException('Confession not found');
    }

    await this.prisma.confession.delete({
      where: { id },
    });

    // Delete MP3 files on disk
    const audioDir = join(process.cwd(), 'public', 'confession-audio', id);
    if (existsSync(audioDir)) {
      try {
        rmSync(audioDir, { recursive: true, force: true });
      } catch (err) {
        this.logger.error(`Failed to delete audio directory: ${audioDir}`, err);
      }
    }

    return { message: 'Confession deleted successfully' };
  }

  async uploadAudio(
    id: string,
    voiceParam: string,
    file: Express.Multer.File,
    user: ActiveUserData,
  ) {
    const voiceLower = voiceParam?.toLowerCase();
    if (voiceLower !== 'female' && voiceLower !== 'male') {
      throw new BadRequestException('Voice must be female or male');
    }
    const voiceEnum =
      voiceLower === 'female' ? ConfessionVoice.FEMALE : ConfessionVoice.MALE;

    const confession = await this.prisma.confession.findUnique({
      where: { id },
      include: { audio: true },
    });

    if (!confession || confession.churchId !== user.churchId) {
      throw new NotFoundException('Confession not found');
    }

    if (!file) {
      throw new BadRequestException('Audio file is required');
    }

    if (extname(file.originalname).toLowerCase() !== '.mp3') {
      throw new BadRequestException('File must have a .mp3 extension');
    }

    if (file.mimetype !== 'audio/mpeg') {
      throw new BadRequestException('File mimetype must be audio/mpeg');
    }

    if (file.size > 25 * 1024 * 1024) {
      throw new BadRequestException('Audio file size exceeds 25 MB limit');
    }

    let metadata;
    try {
      metadata = await parseBuffer(file.buffer, { mimeType: 'audio/mpeg' });
    } catch {
      throw new BadRequestException('File is not a valid MP3: parsing failed');
    }

    const isMpeg =
      metadata.format.container === 'MPEG' ||
      metadata.format.codec?.includes('MPEG') ||
      metadata.format.codec?.includes('MP3') ||
      metadata.format.codec === 'MPEG 1 Layer 3';

    if (!isMpeg) {
      throw new BadRequestException('File is not a valid MP3 audio file');
    }

    const durationSec = Math.round(metadata.format.duration || 0);
    if (durationSec <= 0) {
      throw new BadRequestException(
        'Could not determine audio duration from MP3',
      );
    }

    const fileHash = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex')
      .substring(0, 8);
    const fileName = `${voiceLower}-${fileHash}.mp3`;
    const dirPath = join(
      process.cwd(),
      'public',
      'confession-audio',
      confession.id,
    );
    const filePath = join(dirPath, fileName);
    const relativeUrl = `/public/confession-audio/${confession.id}/${fileName}`;
    const textHash = getBodyHash(confession.body);

    // Write new file first
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
    await writeFile(filePath, file.buffer);

    const existingAudio = confession.audio.find((a) => a.voice === voiceEnum);

    // Upsert the audio row
    await this.prisma.confessionAudio.upsert({
      where: {
        confessionId_voice: {
          confessionId: confession.id,
          voice: voiceEnum,
        },
      },
      create: {
        confessionId: confession.id,
        voice: voiceEnum,
        url: relativeUrl,
        durationSec,
        sizeBytes: file.size,
        textHash,
      },
      update: {
        url: relativeUrl,
        durationSec,
        sizeBytes: file.size,
        textHash,
      },
    });

    // Remove old file if URL changed
    if (existingAudio && existingAudio.url !== relativeUrl) {
      const oldDiskPath = join(
        process.cwd(),
        existingAudio.url.replace(/^\//, ''),
      );
      if (existsSync(oldDiskPath)) {
        try {
          unlinkSync(oldDiskPath);
        } catch (err) {
          this.logger.warn(
            `Could not remove old audio file ${oldDiskPath}:`,
            err,
          );
        }
      }
    }

    return this.findOne(confession.id, user.churchId, user);
  }

  async removeAudio(id: string, voiceParam: string, user: ActiveUserData) {
    const voiceLower = voiceParam?.toLowerCase();
    if (voiceLower !== 'female' && voiceLower !== 'male') {
      throw new BadRequestException('Voice must be female or male');
    }
    const voiceEnum =
      voiceLower === 'female' ? ConfessionVoice.FEMALE : ConfessionVoice.MALE;

    const confession = await this.prisma.confession.findUnique({
      where: { id },
      include: { audio: true },
    });

    if (!confession || confession.churchId !== user.churchId) {
      throw new NotFoundException('Confession not found');
    }

    const audio = confession.audio.find((a) => a.voice === voiceEnum);
    if (!audio) {
      throw new NotFoundException(`No audio found for voice: ${voiceLower}`);
    }

    await this.prisma.confessionAudio.delete({
      where: { id: audio.id },
    });

    const diskPath = join(process.cwd(), audio.url.replace(/^\//, ''));
    if (existsSync(diskPath)) {
      try {
        unlinkSync(diskPath);
      } catch (err) {
        this.logger.warn(`Could not remove audio file ${diskPath}:`, err);
      }
    }

    return { message: 'Audio deleted successfully' };
  }

  async recordListen(id: string) {
    const defaultChurchId = await this.prisma.getDefaultChurchId();

    const confession = await this.prisma.confession.findUnique({
      where: { id },
      select: { id: true, churchId: true, status: true },
    });

    if (
      !confession ||
      confession.churchId !== defaultChurchId ||
      confession.status !== ConfessionStatus.PUBLISHED
    ) {
      throw new NotFoundException('Confession not found');
    }

    await this.prisma.confession.update({
      where: { id },
      data: {
        listenCount: { increment: 1 },
      },
    });
  }

  private async generateUniqueSlug(
    churchId: string,
    baseSlug: string,
    excludeId?: string,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 2;

    while (true) {
      const existing = await this.prisma.confession.findFirst({
        where: {
          churchId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true },
      });

      if (!existing) {
        return slug;
      }

      const suffix = `-${counter}`;
      const trimmedBase = baseSlug.slice(0, 160 - suffix.length);
      slug = `${trimmedBase}${suffix}`;
      counter++;
    }
  }

  private async resolveCategoryCasing(
    churchId: string,
    newCategory: string,
  ): Promise<string> {
    const trimmed = newCategory.trim();
    if (!trimmed) return trimmed;

    const existingCategories = await this.prisma.confession.findMany({
      where: {
        churchId,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });

    const match = existingCategories.find(
      (c) => c.category?.toLowerCase() === trimmed.toLowerCase(),
    );

    return match?.category ? match.category : trimmed;
  }

  private formatListItem(
    item: ConfessionWithAudio,
    isAdmin: boolean,
    position: number | null,
  ): ConfessionListItem {
    const audioMap: Record<string, ConfessionAudioItem> = {};
    for (const a of item.audio) {
      audioMap[a.voice.toLowerCase()] = {
        url: a.url,
        durationSec: a.durationSec,
      };
    }

    const result: ConfessionListItem = {
      id: item.id,
      slug: item.slug,
      title: item.title,
      excerpt: generateExcerpt(item.body),
      scriptureRef: item.scriptureRef,
      category: item.category,
      status: item.status,
      position: item.status === ConfessionStatus.PUBLISHED ? position : null,
      wordCount: calculateWordCount(item.body),
      listenCount: item.listenCount,
      audio: audioMap,
    };

    if (isAdmin) {
      const currentHash = getBodyHash(item.body);
      const audioStaleMap: Record<string, boolean> = {};
      for (const a of item.audio) {
        audioStaleMap[a.voice.toLowerCase()] = a.textHash !== currentHash;
      }
      result.audioStale = audioStaleMap;
    }

    return result;
  }

  private formatFullConfession(
    confession: ConfessionWithAudio,
    isAdmin: boolean,
    position: number | null,
    previous: { slug: string; title: string } | null,
    next: { slug: string; title: string } | null,
  ): ConfessionDetail {
    const base = this.formatListItem(confession, isAdmin, position);

    return {
      ...base,
      body: confession.body,
      previous,
      next,
    };
  }
}
