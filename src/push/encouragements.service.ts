import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEncouragementDto,
  UpdateEncouragementDto,
} from './dto/encouragement.dto';

@Injectable()
export class EncouragementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(churchId: string) {
    return this.prisma.encouragementMessage.findMany({
      where: { churchId },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findOne(id: string, churchId: string) {
    const item = await this.prisma.encouragementMessage.findUnique({
      where: { id },
    });
    if (!item || item.churchId !== churchId) {
      throw new NotFoundException('Encouragement message not found');
    }
    return item;
  }

  async create(churchId: string, dto: CreateEncouragementDto) {
    return this.prisma.encouragementMessage.create({
      data: {
        churchId,
        text: dto.text.trim(),
        reference: dto.reference?.trim() || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });
  }

  async update(id: string, churchId: string, dto: UpdateEncouragementDto) {
    await this.findOne(id, churchId);

    return this.prisma.encouragementMessage.update({
      where: { id },
      data: {
        text: dto.text !== undefined ? dto.text.trim() : undefined,
        reference:
          dto.reference !== undefined
            ? dto.reference?.trim() || null
            : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async remove(id: string, churchId: string) {
    await this.findOne(id, churchId);

    await this.prisma.encouragementMessage.delete({
      where: { id },
    });

    return { message: 'Encouragement message deleted successfully' };
  }
}
