import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check health and database connectivity' })
  @ApiResponse({
    status: 200,
    description: 'Application and database are healthy',
  })
  @ApiResponse({ status: 503, description: 'Database query failed' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
        database: 'down',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
