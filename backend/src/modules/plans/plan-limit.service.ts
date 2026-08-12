import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantContextService } from '../../common/tenancy/tenant-context.service';
import {
  BranchStatus,
  EmployeeStatus,
  SubscriptionStatus,
} from '../../generated/prisma/enums';
import { forbidden } from '../../common/errors/app-error';

/**
 * TZ 3.16.4 — tarif limitlarini tekshirish nuqtasi (hook).
 *
 * Hozir barcha kompaniyalar `DEFAULT` tarifda va limitlar `null` (= cheksiz),
 * shuning uchun bu tekshiruvlar amalda hech qachon ishga tushmaydi. Ular kod ichida
 * mavjud bo'lishi shart — keyinchalik SaaS ga o'tishda retrofit qilish qimmatga tushadi.
 *
 * Limit oshganda faqat **yangi yaratish** bloklanadi; mavjud yozuvlar tegilmaydi.
 */
@Injectable()
export class PlanLimitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async assertCanCreateBranch(): Promise<void> {
    const limit = await this.limitOf('maxBranches');
    if (limit === null) return;

    const current = await this.prisma.db.branch.count({
      where: { status: BranchStatus.ACTIVE },
    });

    if (current >= limit) {
      throw this.exceeded('maxBranches', limit, current);
    }
  }

  async assertCanCreateEmployee(): Promise<void> {
    const limit = await this.limitOf('maxEmployees');
    if (limit === null) return;

    const current = await this.prisma.db.employee.count({
      where: { status: EmployeeStatus.ACTIVE },
    });

    if (current >= limit) {
      throw this.exceeded('maxEmployees', limit, current);
    }
  }

  private async limitOf(
    field: 'maxBranches' | 'maxEmployees',
  ): Promise<number | null> {
    const companyId = this.tenantContext.companyId;
    if (!companyId) return null;

    // CompanySubscription tenant extension dan tashqarida (platforma jadvali)
    const subscription = await this.tenantContext.runUnscoped(
      'plan: amaldagi tarif',
      () =>
        this.prisma.raw.companySubscription.findFirst({
          where: { companyId, status: SubscriptionStatus.ACTIVE },
          orderBy: { startedAt: 'desc' },
          include: { plan: true },
        }),
    );

    return subscription?.plan[field] ?? null;
  }

  private exceeded(
    metric: string,
    limit: number,
    current: number,
  ): HttpException {
    return forbidden('PLAN_LIMIT_EXCEEDED', {
      args: { metric, limit, current },
      details: { metric: [String(limit)] },
    });
  }
}
