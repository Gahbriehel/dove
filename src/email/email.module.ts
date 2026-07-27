import { Module } from '@nestjs/common';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { ConsoleEmailProvider } from './providers/console-email.provider';

@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      useClass: ConsoleEmailProvider,
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
