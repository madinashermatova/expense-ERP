import { Role, Channel } from '../../generated/prisma/enums';

/**
 * So'rov davomida amal qiladigan tenant konteksti.
 * TZ 3.16.1 — kontekst so'rov boshida aniqlanadi va AsyncLocalStorage da saqlanadi.
 */
export interface TenantStore {
  /** null — faqat PLATFORM_OWNER yoki hali autentifikatsiyadan o'tmagan so'rov uchun */
  companyId: string | null;
  userId: string | null;
  role: Role | null;
  /** DIRECTOR uchun o'z filiali; ADMIN uchun null */
  branchId: string | null;
  channel: Channel;
  /** Audit uchun */
  ip: string | null;
  /**
   * Tenant filtri ataylab o'chirilgan bo'lim (seed, login, platforma amallari).
   * Har doim sabab bilan yoziladi — audit va debug uchun.
   */
  unscopedReason: string | null;
  /** So'rovni loglarda kuzatish uchun */
  requestId: string | null;
}

export function emptyStore(overrides: Partial<TenantStore> = {}): TenantStore {
  return {
    companyId: null,
    userId: null,
    role: null,
    branchId: null,
    channel: Channel.WEB,
    ip: null,
    unscopedReason: null,
    requestId: null,
    ...overrides,
  };
}
