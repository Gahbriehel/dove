import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  SUPER_ADMIN_EMAIL: string = 'superadmin@church.org';

  @IsString()
  @IsOptional()
  SUPER_ADMIN_PASSWORD: string = 'SuperAdmin123!';

  @IsString()
  @IsOptional()
  LOGIN_URL: string = 'http://localhost:3000/login';

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3000';

  @IsUrl({ require_tld: false })
  @IsOptional()
  PROFILE_URL?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  RESEND_WEBHOOK_SECRET?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  VAPID_PUBLIC_KEY?: string;

  @IsString()
  @IsOptional()
  VAPID_PRIVATE_KEY?: string;

  @IsString()
  @IsOptional()
  VAPID_SUBJECT: string = 'mailto:info@abwog.org';

  @IsString()
  @IsOptional()
  CRON_SECRET?: string;

  @IsString()
  @IsOptional()
  PUSH_TIMEZONE: string = 'Africa/Lagos';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  if (
    validatedConfig.NODE_ENV === Environment.Production &&
    (!config.SUPER_ADMIN_PASSWORD ||
      validatedConfig.SUPER_ADMIN_PASSWORD === 'SuperAdmin123!')
  ) {
    throw new Error(
      'SUPER_ADMIN_PASSWORD must be explicitly configured with a non-default password in production environment.',
    );
  }

  return validatedConfig;
}
