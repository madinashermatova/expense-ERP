import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { NumberingService } from './numbering.service';

/** `CurrencyModule` va `FilesModule` global — bu yerda qayta import qilinmaydi */
@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, NumberingService],
  exports: [ExpensesService, NumberingService],
})
export class ExpensesModule {}
