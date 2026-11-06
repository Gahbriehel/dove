import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { DepartmentsModule } from '../departments/departments.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ClaimRateLimiter } from './claim-rate-limiter';
import { MemberSessionService } from './member-session.service';
import { MemberAuthGuard } from './guards/member-auth.guard';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    DepartmentsModule,
    EmailModule,
    JwtModule.register({}),
    // Per-IP cap: 15 per minute by default (used by POST /profile/login);
    // POST /profile/claim overrides this via @Throttle to 60 per 10 min.
    ThrottlerModule.forRoot([{ ttl: 60 * 1000, limit: 15 }]),
  ],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    ClaimRateLimiter,
    MemberSessionService,
    MemberAuthGuard,
  ],
  exports: [ProfileService, MemberSessionService, MemberAuthGuard],
})
export class ProfileModule {}
