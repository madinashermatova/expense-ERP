import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/errors/validation-error';
import { EnvironmentVariables, NodeEnv } from './config/env.validation';
import { setupSwagger, SWAGGER_PATH } from './config/swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.setGlobalPrefix(config.get('API_PREFIX', { infer: true }));
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Xato tanasi yagona formatga keladi va xabarlar so'rov tiliga tarjima qilinadi
      exceptionFactory: validationExceptionFactory,
    }),
  );

  /*
   * Swagger prodda sukut bo'yicha yopiq: `SWAGGER_ENABLED=true` bo'lsa ham
   * `NODE_ENV=production` da ataylab qo'shimcha ruxsat talab qilinadi.
   */
  const apiPrefix = config.get('API_PREFIX', { infer: true });
  const swaggerEnabled =
    config.get('SWAGGER_ENABLED', { infer: true }) &&
    config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production;

  if (swaggerEnabled) {
    setupSwagger(app, apiPrefix);
  }

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  console.log(`API tayyor: http://localhost:${port}/${apiPrefix}`);
  if (swaggerEnabled) {
    console.log(
      `Swagger: http://localhost:${port}/${apiPrefix}/${SWAGGER_PATH}`,
    );
  }
}

void bootstrap();
