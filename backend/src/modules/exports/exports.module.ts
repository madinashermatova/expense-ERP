import { BullModule } from '@nestjs/bullmq';
import { Module, Provider } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { ReportsModule } from '../reports/reports.module';
import { ExportCleanupCron } from './export-cleanup.cron';
import { ExportDataService } from './export-data.service';
import { EXPORT_QUEUE } from './export-queue';
import { ExportsController } from './exports.controller';
import { ExportsProcessor } from './exports.processor';
import { ExportsService } from './exports.service';
import { PdfWriter } from './pdf.writer';
import { XlsxWriter } from './xlsx.writer';

/** Testlarda worker ro'yxatga olinmaydi — sabab `NotificationsModule` dagi bilan bir xil */
function workerProviders(): Provider[] {
  return process.env.DISABLE_QUEUE_WORKER === 'true' ? [] : [ExportsProcessor];
}

@Module({
  imports: [
    BullModule.registerQueue({ name: EXPORT_QUEUE }),
    ExpensesModule,
    ReportsModule,
  ],
  controllers: [ExportsController],
  providers: [
    ExportsService,
    ExportDataService,
    XlsxWriter,
    PdfWriter,
    ExportCleanupCron,
    ...workerProviders(),
  ],
  exports: [ExportsService],
})
export class ExportsModule {}
