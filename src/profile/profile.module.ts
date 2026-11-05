import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DepartmentsModule } from '../departments/departments.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimRateLimiter } from './claim-rate-limiter';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    DepartmentsModule,
    EmailModule,
    JwtModule.register({}),
    // Per-IP cap for POST /profile/claim: 60 per 10 min (a shared foyer Wi-Fi
    // IP serves the whole congregation, so this is deliberately generous).
    ThrottlerModule.forRoot([{ ttl: 10 * 60 * 1000, limit: 60 }]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService, ClaimRateLimiter],
  exports: [ProfileService],
})
export class ProfileModule {}
