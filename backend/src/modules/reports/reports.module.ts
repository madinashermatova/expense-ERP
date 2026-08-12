import { Module } from '@nestjs/common';
import { ReportCacheService } from './report-cache.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/** `SettingsModule` global — qayta import qilinmaydi */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportCacheService],
  exports: [ReportsService],
})
export class ReportsModule {}
