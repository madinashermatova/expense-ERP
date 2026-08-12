import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { CommonModule } from './common/common.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { DEFAULT_LANGUAGE } from './common/i18n/languages';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { EditRequestsModule } from './modules/edit-requests/edit-requests.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { ExportsModule } from './modules/exports/exports.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { PlansModule } from './modules/plans/plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    /*
     * i18n (TZ 4.3, 5.4). Tarjimalar `src/i18n/{uz,ru}/*.json` da; til so'rovdan
     * `?lang=`, `x-lang` yoki `Accept-Language` orqali aniqlanadi, foydalanuvchi
     * sozlamasi esa `TranslationService` da ulardan ustun turadi.
     */
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LANGUAGE,
      loaderOptions: {
        // `__dirname` — dev/testda `src`, prodda `dist` (JSON lar nest-cli assets bilan ko'chadi)
        path: join(__dirname, 'i18n'),
        watch: false,
      },
      resolvers: [
        new QueryResolver(['lang']),
        new HeaderResolver(['x-lang']),
        AcceptLanguageResolver,
      ],
      // Kalit topilmaganda log yozilmaydi: `TranslationService` bu holatni o'zi hal qiladi
      logging: false,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        throttlers: [
          {
            name: 'global',
            ttl: config.get('THROTTLE_GLOBAL_TTL', { infer: true }) * 1000,
            limit: config.get('THROTTLE_GLOBAL_LIMIT', { infer: true }),
          },
          {
            name: 'auth',
            ttl: config.get('THROTTLE_AUTH_TTL', { infer: true }) * 1000,
            limit: config.get('THROTTLE_AUTH_LIMIT', { infer: true }),
          },
        ],
        // Integratsion testlarda bir IP dan ko'p so'rov yuboriladi — rate limit
        // boshqa xatti-harakatni tekshirishga xalaqit bermasligi uchun o'chiriladi.
        // Throttler ning o'zi `throttle.int-spec.ts` da alohida sinaladi.
        skipIf: () => process.env.DISABLE_THROTTLE === 'true',
      }),
    }),
    /*
     * BullMQ — bildirishnoma navbati (TZ 3.11). Job lar Redis da saqlanadi, shuning
     * uchun ilova qayta ishga tushsa ham yuborilmagan xabar yo'qolmaydi.
     */
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => {
        const host: string = config.get('REDIS_HOST', { infer: true });
        const port: number = config.get('REDIS_PORT', { infer: true });
        const password: string | undefined = config.get('REDIS_PASSWORD', {
          infer: true,
        });
        const db: number = config.get('REDIS_DB', { infer: true });

        return { connection: { host, port, password, db } };
      },
    }),
    ScheduleModule.forRoot(),
    TenancyModule,
    PrismaModule,
    CommonModule,
    PlansModule,
    AuthModule,
    BranchesModule,
    EmployeesModule,
    CategoriesModule,
    FilesModule,
    SettingsModule,
    NotificationsModule,
    CurrencyModule,
    ExpensesModule,
    EditRequestsModule,
    RefundsModule,
    BudgetsModule,
    ReportsModule,
    ExportsModule,
    AuditModule,
    TelegramModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Faqat `@Audit()` bilan belgilangan endpointlarda ishlaydi (TZ 3.14)
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
