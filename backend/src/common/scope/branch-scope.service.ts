import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { Role } from '../../generated/prisma/enums';
import { forbidden, notFound } from '../../common/errors/app-error';

/**
 * TZ 3.1 — filial doirasi (scope) server tomonda majburlanadi:
 * direktor faqat o'z `branchId` ma'lumotlarini ko'radi, frontend filtriga tayanilmaydi.
 *
 * Tenant izolyatsiyasidan farqli o'laroq bu qatlam Prisma extension da emas:
 * filial doirasi biznes qoidasi (masalan admin uchun cheklov yo'q, ba'zi hisobotlarda
 * ataylab kengroq), shuning uchun servis darajasida aniq chaqiriladi.
 */
@Injectable()
export class BranchScopeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  get isDirector(): boolean {
    return this.tenantContext.role === Role.DIRECTOR;
  }

  /** Direktorning filiali; boshqa rollar uchun null */
  get ownBranchId(): string | null {
    return this.isDirector ? this.tenantContext.branchId : null;
  }

  /**
   * Ro'yxat so'rovlari uchun filial filtri.
   * Direktor boshqa filialni so'rasa — `ForbiddenException`.
   */
  resolveListFilter(requestedBranchId?: string): string | undefined {
    const own = this.ownBranchId;
    if (!this.isDirector) return requestedBranchId;

    if (!own) {
      // Direktor xodim kartochkasiga bog'lanmagan — filialni aniqlab bo'lmaydi
      throw forbidden('BRANCH_SCOPE_MISSING');
    }

    if (requestedBranchId && requestedBranchId !== own) {
      throw forbidden('BRANCH_FORBIDDEN');
    }

    return own;
  }

  /**
   * Bitta yozuvga kirishni tekshiradi.
   * Boshqa filial yozuvi so'ralganda 404 — mavjudligini oshkor qilmaslik uchun (TZ 3.1).
   */
  assertCanAccess(branchId: string): void {
    const own = this.ownBranchId;
    if (!this.isDirector) return;
    if (own !== branchId) {
      throw notFound('NOT_FOUND');
    }
  }

  /** Yozish amallarida: direktor boshqa filialga yoza olmaydi (403, yashirish shart emas) */
  assertCanWrite(branchId: string): void {
    const own = this.ownBranchId;
    if (!this.isDirector) return;
    if (own !== branchId) {
      throw forbidden('BRANCH_FORBIDDEN');
    }
  }
}
