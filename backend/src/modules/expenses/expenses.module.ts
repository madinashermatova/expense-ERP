import { Module } from '@nestjs/common';
import { ApprovalReminderCron } from './approval-reminder.cron';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { NumberingService } from './numbering.service';

/** `CurrencyModule`, `FilesModule` va `NotificationsModule` global — qayta import qilinmaydi */
@Module({
  controllers: [ApprovalsController, ExpensesController],
  providers: [
    ExpensesService,
    NumberingService,
    ApprovalsService,
    ApprovalReminderCron,
  ],
  exports: [ExpensesService, NumberingService, ApprovalsService],
})
export class ExpensesModule {}
