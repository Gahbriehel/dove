import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';
import { EMAIL_SERVICE } from './interfaces/email-service.interface';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    {
      provide: EMAIL_SERVICE,
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('RESEND_API_KEY');
        if (
          apiKey &&
          apiKey.trim() !== '' &&
          !apiKey.includes('<your-resend-api-key>')
        ) {
          return new ResendEmailProvider(configService);
        }
        return new ConsoleEmailProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService, EMAIL_SERVICE],
})
export class EmailModule {}
