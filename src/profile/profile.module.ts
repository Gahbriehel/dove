import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DepartmentsModule } from '../departments/departments.module';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [PrismaModule, ConfigModule, DepartmentsModule, EmailModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
