import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const toInt = () =>
  Transform(({ value }) => (value === undefined ? undefined : Number(value)));
const toBool = () =>
  Transform(({ value }) => {
    if (typeof value === 'boolean') return value;
    return value === 'true' || value === '1';
  });

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @toInt()
  PORT = 3000;

  @IsString()
  API_PREFIX = 'api';

  @IsString()
  APP_URL = 'http://localhost:3000';

  @IsString()
  WEB_URL = 'http://localhost:5173';

  @IsString()
  DEFAULT_TIMEZONE = 'Asia/Tashkent';

  @IsString()
  DEFAULT_LANGUAGE = 'uz';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  TEST_DATABASE_URL?: string;

  @IsString()
  REDIS_HOST = 'localhost';

  @IsInt()
  @toInt()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsInt()
  @toInt()
  REDIS_DB = 0;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_TTL = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  JWT_REFRESH_TTL = '7d';

  @IsString()
  REFRESH_COOKIE_NAME = 'erp_rt';

  @IsInt()
  @Min(1)
  @toInt()
  LOGIN_MAX_ATTEMPTS = 5;

  @IsInt()
  @Min(1)
  @toInt()
  LOGIN_LOCK_MINUTES = 15;

  /** AES-256-GCM kaliti — aynan 64 ta hex belgi (32 bayt) */
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message:
      "ENCRYPTION_KEY 64 ta hex belgidan iborat bo'lishi kerak (32 bayt)",
  })
  ENCRYPTION_KEY!: string;

  @IsString()
  S3_ENDPOINT = 'http://localhost:9000';

  @IsString()
  S3_REGION = 'us-east-1';

  @IsString()
  S3_BUCKET = 'erp-files';

  @IsString()
  @IsNotEmpty()
  S3_ACCESS_KEY!: string;

  @IsString()
  @IsNotEmpty()
  S3_SECRET_KEY!: string;

  @IsBoolean()
  @toBool()
  S3_FORCE_PATH_STYLE = true;

  @IsInt()
  @toInt()
  S3_SIGNED_URL_TTL_SECONDS = 900;

  @IsInt()
  @toInt()
  UPLOAD_MAX_FILE_SIZE_MB = 10;

  @IsInt()
  @toInt()
  UPLOAD_MAX_FILES_PER_EXPENSE = 5;

  /**
   * Swagger UI (`/api/docs`). Prodda ataylab yopiladi: endpoint ro'yxati va
   * so'rov sxemalari hujum yuzasini kengaytiradi.
   */
  @IsBoolean()
  @toBool()
  SWAGGER_ENABLED = true;

  @IsBoolean()
  @toBool()
  BOT_ENABLED = false;

  @IsString()
  @IsOptional()
  TELEGRAM_BOT_TOKEN?: string;

  @IsInt()
  @toInt()
  TELEGRAM_SESSION_DAYS = 30;

  @IsString()
  CBU_API_URL = 'https://cbu.uz/uz/arkhiv-kursov-valyut/json';

  @IsString()
  CURRENCY_CRON = '0 9 * * *';

  @IsString()
  LOG_LEVEL = 'debug';

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  @IsInt()
  @toInt()
  THROTTLE_AUTH_LIMIT = 5;

  @IsInt()
  @toInt()
  THROTTLE_AUTH_TTL = 60;

  @IsInt()
  @toInt()
  THROTTLE_GLOBAL_LIMIT = 100;

  @IsInt()
  @toInt()
  THROTTLE_GLOBAL_TTL = 60;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n');
    throw new Error(`Muhit o'zgaruvchilari noto'g'ri:\n${details}`);
  }

  if (validated.BOT_ENABLED && !validated.TELEGRAM_BOT_TOKEN) {
    throw new Error("BOT_ENABLED=true bo'lganda TELEGRAM_BOT_TOKEN majburiy");
  }

  return validated;
}
