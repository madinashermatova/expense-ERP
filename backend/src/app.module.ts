import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { TenantContextMiddleware } from './common/tenancy/tenant-context.middleware';
import { EnvironmentVariables, validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { EditRequestsModule } from './modules/edit-requests/edit-requests.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PlansModule } from './modules/plans/plans.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
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
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantContextMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
