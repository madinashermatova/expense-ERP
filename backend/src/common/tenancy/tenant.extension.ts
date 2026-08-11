/*
 * Prisma ning `$allOperations` callback i barcha modellar uchun umumiy bo'lgani sababli
 * argumentlari `any` tipida keladi — bu Prisma extension API sining tabiati.
 * Tip xavfsizligi shu fayl ichida qo'lda tekshiriladi (`scopeWhere*`, `scopeData`),
 * shuning uchun `no-unsafe-*` qoidalari faqat shu faylda o'chirilgan.
 */
/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Prisma } from '../../generated/prisma/client';
import { TenantContextService } from './tenant-context.service';
import { isTenantExempt } from './tenant-models';
import { CrossTenantWriteError } from './tenancy.errors';

type AnyArgs = Record<string, unknown>;

/**
 * `where` ga companyId ni AND orqali qo'shadi.
 *
 * Ataylab `{ ...where, companyId }` emas: agar so'rovda boshqa kompaniyaning
 * `companyId` si ko'rsatilgan bo'lsa, uni jim almashtirish chalg'ituvchi bo'lardi.
 * AND bilan natija bo'sh chiqadi — bu aniqroq va xavfsizroq semantika.
 */
function scopeWhere(args: AnyArgs, companyId: string): AnyArgs {
  const where = (args.where ?? {}) as AnyArgs;
  if (Object.keys(where).length === 0) {
    return { ...args, where: { companyId } };
  }
  return { ...args, where: { AND: [where, { companyId }] } };
}

/**
 * Unique operatsiyalar (`findUnique`, `update`, `delete`, `upsert`) uchun.
 *
 * Bu yerda `AND` ishlatib bo'lmaydi — Prisma unique argumentni (`id` yoki compound)
 * `where` ning yuqori darajasida talab qiladi. Shuning uchun `companyId` yonma-yon
 * qo'shiladi (Prisma 5 dan beri ruxsat etilgan "extended where unique").
 * Natijada boshqa kompaniya yozuvi so'ralganda `null` yoki `P2025` qaytadi.
 */
function scopeWhereUnique(
  model: string,
  args: AnyArgs,
  companyId: string,
): AnyArgs {
  const where = (args.where ?? {}) as AnyArgs;
  const given = where.companyId;
  if (typeof given === 'string' && given !== companyId) {
    throw new CrossTenantWriteError(model, companyId, given);
  }
  return { ...args, where: { ...where, companyId } };
}

/** `data` ga companyId ni qo'yadi; boshqa kompaniya ko'rsatilgan bo'lsa xato */
function scopeData(model: string, data: unknown, companyId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) => scopeData(model, row, companyId));
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  const row = data as AnyArgs;
  const given = row.companyId;
  if (typeof given === 'string' && given !== companyId) {
    throw new CrossTenantWriteError(model, companyId, given);
  }
  return { ...row, companyId };
}

/**
 * Tenant izolyatsiyasi — markazlashgan qatlam (TZ 3.16.1, 4.2).
 *
 * Har bir biznes so'roviga avtomatik `WHERE companyId = ctx.companyId` qo'shiladi va
 * `create` da `companyId` to'ldiriladi. Endpoint kodida qo'lda filtr yozishga tayanilmaydi —
 * bu extension o'chirilsa `test:tenancy` yiqilishi kerak.
 *
 * `findUnique` / `update` / `delete` uchun ham `where` ga `companyId` qo'shiladi —
 * Prisma 5 dan beri unique where qo'shimcha filtrlarni qabul qiladi (extended where unique).
 * Natijada boshqa kompaniyaning yozuvi so'ralganda `null` yoki `P2025` qaytadi, ya'ni 404.
 */
export function createTenantExtension(ctx: TenantContextService) {
  return Prisma.defineExtension({
    name: 'tenant-isolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: any) {
          if (isTenantExempt(model) || ctx.isUnscoped) {
            return query(args);
          }

          const companyId = ctx.requireCompanyId(model ?? 'unknown', operation);
          const a = (args ?? {}) as AnyArgs;

          switch (operation) {
            case 'findUnique':
            case 'findUniqueOrThrow':
            case 'update':
            case 'delete':
              return query(scopeWhereUnique(model, a, companyId));

            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy':
            case 'updateMany':
            case 'deleteMany':
              return query(scopeWhere(a, companyId));

            case 'create':
              return query({ ...a, data: scopeData(model, a.data, companyId) });

            case 'createMany':
            case 'createManyAndReturn':
              return query({ ...a, data: scopeData(model, a.data, companyId) });

            case 'upsert':
              return query({
                ...scopeWhereUnique(model, a, companyId),
                create: scopeData(model, a.create, companyId),
                update: a.update,
              });

            default:
              return query(a);
          }
        },
      },
    },
  });
}
