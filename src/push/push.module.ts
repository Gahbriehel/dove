import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileModule } from '../profile/profile.module';
import { EncouragementsController } from './encouragements.controller';
import { EncouragementsService } from './encouragements.service';
import { NightPrayerController } from './night-prayer.controller';
import { NightPrayerService } from './night-prayer.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { PushTickService } from './push-tick.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    JwtModule.register({}),
    ProfileModule,
    ThrottlerModule.forRoot([{ ttl: 60 * 1000, limit: 10 }]),
  ],
  controllers: [
    PushController,
    NightPrayerController,
    EncouragementsController,
    NotificationSettingsController,
  ],
  providers: [
    PushService,
    PushTickService,
    NightPrayerService,
    EncouragementsService,
    NotificationSettingsService,
  ],
  exports: [
    PushService,
    PushTickService,
    NightPrayerService,
    EncouragementsService,
    NotificationSettingsService,
  ],
})
export class PushModule {}
