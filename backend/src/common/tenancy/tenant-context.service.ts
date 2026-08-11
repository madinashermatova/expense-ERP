import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger } from '@nestjs/common';
import { Channel, Role } from '../../generated/prisma/enums';
import { emptyStore, TenantStore } from './tenant-context';
import { TenantContextMissingError } from './tenancy.errors';

@Injectable()
export class TenantContextService {
  private readonly logger = new Logger(TenantContextService.name);
  private readonly als = new AsyncLocalStorage<TenantStore>();

  /** So'rov (yoki job) davomiyligida kontekstni o'rnatib, funksiyani bajaradi */
  run<T>(store: Partial<TenantStore>, fn: () => T): T {
    return this.als.run(emptyStore(store), fn);
  }

  /**
   * Tenant filtrisiz bajarish — faqat sanoqli holatlar uchun:
   * login (companyId hali noma'lum), seed, migratsiya, platforma amallari, cron bootstrap.
   * Sabab majburiy va logga yoziladi.
   */
  async runUnscoped<T>(reason: string, fn: () => Promise<T>): Promise<T> {
    const current = this.als.getStore();
    this.logger.debug(`Tenant filtri chetlab o'tildi: ${reason}`);
    // `await` aynan kontekst ichida bo'lishi shart — Prisma promise lazy,
    // so'rov `.then` chaqirilganda boshlanadi.
    return this.als.run(
      emptyStore({ ...current, unscopedReason: reason }),
      async () => await fn(),
    );
  }

  /** `run` ning async varianti — Prisma so'rovlari uchun shuni ishlating */
  async runAsync<T>(
    store: Partial<TenantStore>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return this.als.run(emptyStore(store), async () => await fn());
  }

  /** Joriy kontekstga qisman o'zgarish kiritish (masalan login dan keyin companyId ni to'ldirish) */
  patch(patch: Partial<TenantStore>): void {
    const store = this.als.getStore();
    if (!store) {
      throw new Error(
        "Tenant konteksti mavjud emas — patch() chaqirib bo'lmaydi",
      );
    }
    Object.assign(store, patch);
  }

  get store(): TenantStore | undefined {
    return this.als.getStore();
  }

  get companyId(): string | null {
    return this.als.getStore()?.companyId ?? null;
  }

  get userId(): string | null {
    return this.als.getStore()?.userId ?? null;
  }

  get role(): Role | null {
    return this.als.getStore()?.role ?? null;
  }

  get branchId(): string | null {
    return this.als.getStore()?.branchId ?? null;
  }

  get channel(): Channel {
    return this.als.getStore()?.channel ?? Channel.SYSTEM;
  }

  get ip(): string | null {
    return this.als.getStore()?.ip ?? null;
  }

  get isUnscoped(): boolean {
    return (
      this.als.getStore()?.unscopedReason !== null &&
      this.als.getStore() !== undefined
    );
  }

  /** Biznes so'rovi uchun companyId — yo'q bo'lsa xato (hech qachon "hammasi" emas) */
  requireCompanyId(model: string, operation: string): string {
    const companyId = this.companyId;
    if (!companyId) {
      throw new TenantContextMissingError(model, operation);
    }
    return companyId;
  }
}
