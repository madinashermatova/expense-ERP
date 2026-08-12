import { Controller, Get, Query } from '@nestjs/common';
import {
  DynamicsReportDto,
  GroupedReportDto,
  ReportFilterDto,
} from './dto/report-filter.dto';
import {
  BranchRow,
  BudgetVsActualRow,
  DynamicsPoint,
  EmployeeRow,
  GroupedRow,
  ReportsService,
  SummaryReport,
} from './reports.service';

/**
 * TZ 3.13 — hisobotlar.
 *
 * Rol tekshiruvi ataylab `@Roles` bilan emas: direktor ham hisobot ko'radi, lekin
 * faqat o'z filiali kesimida — buni `BranchScopeService` servis qatlamida majburlaydi
 * (boshqa filial `branchId` bilan so'rov → 403).
 */
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@Query() query: ReportFilterDto): Promise<SummaryReport> {
    return this.reports.summary(query);
  }

  @Get('by-branch')
  byBranch(@Query() query: GroupedReportDto): Promise<BranchRow[]> {
    return this.reports.byBranch(query);
  }

  @Get('by-category')
  byCategory(@Query() query: GroupedReportDto): Promise<GroupedRow[]> {
    return this.reports.byCategory(query);
  }

  /** Sukut bo'yicha TOP-10 (TZ 3.13) */
  @Get('by-employee')
  byEmployee(@Query() query: GroupedReportDto): Promise<EmployeeRow[]> {
    return this.reports.byEmployee(query);
  }

  @Get('dynamics')
  dynamics(@Query() query: DynamicsReportDto): Promise<DynamicsPoint[]> {
    return this.reports.dynamics(query);
  }

  @Get('budget-vs-actual')
  budgetVsActual(
    @Query() query: ReportFilterDto,
  ): Promise<BudgetVsActualRow[]> {
    return this.reports.budgetVsActual(query);
  }
}
