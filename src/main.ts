import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { Logger as PinoLogger } from 'nestjs-pino';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  // Body Parser Limits (for larger payloads and file uploads)
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  // Static Assets (uploads)
  app.useStaticAssets(join(process.cwd(), 'public'), {
    prefix: '/public/',
  });

  // Global API Prefix
  app.setGlobalPrefix('api/v1');

  // CORS
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger OpenAPI Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Church Events Platform API')
    .setDescription(
      'Backend API foundation for Church Events Platform and Management System',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('port') || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Application running on port ${port}`);
  logger.log(
    `Swagger documentation available at http://localhost:${port}/api/docs`,
  );
}
void bootstrap();
