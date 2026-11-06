import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GivingAccountsController } from './giving-accounts.controller';
import { GivingAccountsService } from './giving-accounts.service';

@Module({
  imports: [PrismaModule],
  controllers: [GivingAccountsController],
  providers: [GivingAccountsService],
  exports: [GivingAccountsService],
})
export class GivingAccountsModule {}
