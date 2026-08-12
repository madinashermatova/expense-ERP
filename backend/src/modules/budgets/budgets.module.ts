import { Global, Module } from '@nestjs/common';
import { BudgetsController } from './budgets.controller';
import { BudgetsService } from './budgets.service';

/** Global: xarajatlar (S6), tasdiqlash (S7) va qaytarish (S9) limitlarni baholaydi */
@Global()
@Module({
  controllers: [BudgetsController],
  providers: [BudgetsService],
  exports: [BudgetsService],
})
export class BudgetsModule {}
