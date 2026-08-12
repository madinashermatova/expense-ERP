import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { ReportsModule } from '../reports/reports.module';
import { RefundsModule } from '../refunds/refunds.module';
import { EditRequestsModule } from '../edit-requests/edit-requests.module';
import { BotDirectoryService } from './bot-directory.service';
import { BotLauncherService } from './bot-launcher.service';
import { BotRouterService } from './bot-router.service';
import { BotSessionService } from './bot-session.service';
import { BotTextService } from './bot-text.service';
import { AccountsFlowHandler } from './flows/accounts.flow';
import { ApprovalsFlowHandler } from './flows/approvals.flow';
import { ExpenseFlowHandler } from './flows/expense.flow';
import { RequestsFlowHandler } from './flows/requests.flow';
import { ListsFlowHandler } from './flows/lists.flow';
import { LoginFlowHandler } from './flows/login.flow';
import { MenuPresenter } from './menu.presenter';
import { TelegramAuthService } from './telegram-auth.service';

/** Telegram bot (TZ 3.12, 3.16.5) */
@Module({
  imports: [ExpensesModule, ReportsModule, RefundsModule, EditRequestsModule],
  providers: [
    BotDirectoryService,
    BotSessionService,
    BotTextService,
    TelegramAuthService,
    MenuPresenter,
    LoginFlowHandler,
    AccountsFlowHandler,
    ExpenseFlowHandler,
    ListsFlowHandler,
    ApprovalsFlowHandler,
    RequestsFlowHandler,
    BotRouterService,
    BotLauncherService,
  ],
  exports: [
    BotRouterService,
    BotDirectoryService,
    BotSessionService,
    BotTextService,
  ],
})
export class TelegramModule {}
