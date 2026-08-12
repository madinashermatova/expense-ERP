import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/errors/validation-error';
import { EnvironmentVariables } from './config/env.validation';

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

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  console.log(
    `API tayyor: http://localhost:${port}/${config.get('API_PREFIX', { infer: true })}`,
  );
}

void bootstrap();
