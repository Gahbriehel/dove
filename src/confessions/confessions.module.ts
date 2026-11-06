import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { ConfessionsController } from './confessions.controller';
import { ConfessionsService } from './confessions.service';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([{ ttl: 60 * 1000, limit: 20 }]),
  ],
  controllers: [ConfessionsController],
  providers: [ConfessionsService],
  exports: [ConfessionsService],
})
export class ConfessionsModule {}
