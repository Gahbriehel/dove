import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      console.warn(
        'Could not connect to database on startup. Make sure MySQL is running.',
      );
    }
  }

  private cachedDefaultChurchId: string | null = null;

  async getDefaultChurchId(): Promise<string> {
    if (this.cachedDefaultChurchId) {
      return this.cachedDefaultChurchId;
    }

    const defaultSlug = process.env.DEFAULT_CHURCH_SLUG || 'abwog';
    let church = await this.church.findUnique({
      where: { slug: defaultSlug },
    });

    if (!church) {
      church = await this.church.findFirst({
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!church) {
      throw new Error(
        'No default church record found in database. Ensure seeding has run.',
      );
    }

    this.cachedDefaultChurchId = church.id;
    return church.id;
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
