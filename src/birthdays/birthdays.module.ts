import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from '../email/email.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BirthdaysController } from './birthdays.controller';
import { BirthdaysService } from './birthdays.service';

@Module({
  imports: [ConfigModule, PrismaModule, EmailModule],
  controllers: [BirthdaysController],
  providers: [BirthdaysService],
  exports: [BirthdaysService],
})
export class BirthdaysModule {}
