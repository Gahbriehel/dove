import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private cachedDefaultChurchId: string | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async getDefaultChurchId(): Promise<string> {
    if (this.cachedDefaultChurchId) {
      return this.cachedDefaultChurchId;
    }

    const defaultSlug =
      this.configService.get<string>('DEFAULT_CHURCH_SLUG') || 'abwog';
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
