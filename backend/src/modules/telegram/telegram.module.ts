import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { ReportsModule } from '../reports/reports.module';
import { BotDirectoryService } from './bot-directory.service';
import { BotLauncherService } from './bot-launcher.service';
import { BotRouterService } from './bot-router.service';
import { BotSessionService } from './bot-session.service';
import { AccountsFlowHandler } from './flows/accounts.flow';
import { ExpenseFlowHandler } from './flows/expense.flow';
import { ListsFlowHandler } from './flows/lists.flow';
import { LoginFlowHandler } from './flows/login.flow';
import { MenuPresenter } from './menu.presenter';
import { TelegramAuthService } from './telegram-auth.service';

/** Telegram bot (TZ 3.12, 3.16.5) */
@Module({
  imports: [ExpensesModule, ReportsModule],
  providers: [
    BotDirectoryService,
    BotSessionService,
    TelegramAuthService,
    MenuPresenter,
    LoginFlowHandler,
    AccountsFlowHandler,
    ExpenseFlowHandler,
    ListsFlowHandler,
    BotRouterService,
    BotLauncherService,
  ],
  exports: [BotRouterService, BotDirectoryService, BotSessionService],
})
export class TelegramModule {}
