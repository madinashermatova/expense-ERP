import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../generated/prisma/enums';
import { ApprovalsService, BulkApproveResult } from './approvals.service';
import {
  ApproveExpenseDto,
  BulkApproveDto,
  RejectExpenseDto,
} from './dto/decide-expense.dto';
import { ExpenseView } from './expenses.service';

/**
 * TZ 3.7 — tasdiqlash oqimi.
 *
 * Bosqichga qarab kim qaror qila olishi `expense-status.ts` dagi jadvalda: bu yerdagi
 * `@Roles` faqat qo'pol filtr (WORKER baribir Web ga kira olmaydi), haqiqiy tekshiruv
 * servisdа — chunki u statusga ham bog'liq.
 */
@Controller('expenses')
@Roles(Role.ADMIN, Role.DIRECTOR)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  /** 20 tagacha ariza, qisman muvaffaqiyat hisoboti bilan */
  @Post('bulk-approve')
  bulkApprove(@Body() dto: BulkApproveDto): Promise<BulkApproveResult> {
    return this.approvals.bulkApprove(dto.ids);
  }

  /** Qoralamani yoki tuzatilgan arizani tasdiqlash oqimiga uzatadi */
  @Post(':id/submit')
  submit(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseView> {
    return this.approvals.submit(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveExpenseDto,
  ): Promise<ExpenseView> {
    return this.approvals.approve(id, dto.version);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
  ): Promise<ExpenseView> {
    return this.approvals.reject(id, dto.reason, dto.version);
  }

  @Post(':id/request-fix')
  requestFix(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectExpenseDto,
  ): Promise<ExpenseView> {
    return this.approvals.requestFix(id, dto.reason, dto.version);
  }

  /** Kiritgan shaxs o'z arizasini bekor qiladi */
  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string): Promise<ExpenseView> {
    return this.approvals.cancel(id);
  }
}
