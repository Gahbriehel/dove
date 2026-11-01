import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutreachController } from './outreach.controller';
import { OutreachService } from './outreach.service';

@Module({
  imports: [PrismaModule],
  controllers: [OutreachController],
  providers: [OutreachService],
  exports: [OutreachService],
})
export class OutreachModule {}
