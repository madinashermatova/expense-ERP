import { Injectable } from '@nestjs/common';
import { SequenceScope } from '../../generated/prisma/enums';
import { TenantPrismaClient } from '../../common/prisma/prisma.service';

/**
 * Tranzaksiya ichidagi Prisma client.
 *
 * `$transaction` overload qilingani uchun uni `Parameters<>` bilan chiqarib bo'lmaydi —
 * sessiya darajasidagi metodlarni olib tashlash strukturaviy jihatdan aynan shu tipni beradi.
 */
export type TenantTx = Omit<
  TenantPrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

export interface ExpenseNumbers {
  /** EXP-000123 — kompaniya doirasida uzluksiz */
  globalNumber: string;
  /** CHL-2026-0045 — filial kodi + yil + filial ichidagi ketma-ketlik */
  branchNumber: string;
  branchSeqYear: number;
  branchSeq: number;
}

interface SequenceKey {
  companyId: string;
  scope: SequenceScope;
  branchId: string | null;
  year: number;
}

const GLOBAL_PAD = 6;
const BRANCH_PAD = 4;

/**
 * TZ 3.6 — har bir xarajatga ikkita raqam beriladi va ular hech qachon o'zgarmaydi.
 *
 * Ketma-ketlik `number_sequences` jadvalida saqlanadi. Parallel yaratishda dublikat
 * bo'lmasligi uchun har bir kalit **tranzaksiya advisory lock** bilan seriyalanadi:
 * qulf tranzaksiya tugaganda avtomatik bo'shaydi, ya'ni xato yoki rollback holatida
 * ham osilib qolmaydi. `SELECT … FOR UPDATE` dan farqi — qator hali mavjud bo'lmaganda
 * ham ishlaydi, ya'ni "birinchi xarajat" poygasi ham yopiladi.
 *
 * Qulflar har doim bir xil tartibda olinadi (avval global, keyin filial) — deadlock yo'q.
 */
@Injectable()
export class NumberingService {
  async nextForExpense(
    tx: TenantTx,
    params: {
      companyId: string;
      branchId: string;
      branchCode: string;
      date: Date;
    },
  ): Promise<ExpenseNumbers> {
    const { companyId, branchId, branchCode, date } = params;
    // Filial ketma-ketligi har yil boshida 1 dan qayta boshlanadi (TZ 3.6)
    const year = date.getUTCFullYear();

    const globalSeq = await this.next(tx, {
      companyId,
      scope: SequenceScope.EXPENSE_GLOBAL,
      branchId: null,
      year: 0,
    });

    const branchSeq = await this.next(tx, {
      companyId,
      scope: SequenceScope.EXPENSE_BRANCH,
      branchId,
      year,
    });

    return {
      globalNumber: `EXP-${String(globalSeq).padStart(GLOBAL_PAD, '0')}`,
      branchNumber: `${branchCode}-${year}-${String(branchSeq).padStart(BRANCH_PAD, '0')}`,
      branchSeqYear: year,
      branchSeq,
    };
  }

  /** Kalitni qulflaydi va keyingi qiymatni qaytaradi */
  private async next(tx: TenantTx, key: SequenceKey): Promise<number> {
    await this.lock(tx, key);

    const bumped = await tx.$queryRaw<{ lastValue: number }[]>`
      UPDATE "number_sequences"
         SET "lastValue" = "lastValue" + 1
       WHERE "companyId" = ${key.companyId}
         AND "scope" = ${key.scope}::"SequenceScope"
         AND "year" = ${key.year}
         AND "branchId" IS NOT DISTINCT FROM ${key.branchId}
      RETURNING "lastValue"
    `;

    if (bumped.length > 0) return bumped[0].lastValue;

    // Qator hali yo'q — advisory lock tufayli bu yerga bir vaqtda faqat bitta tranzaksiya kiradi
    await tx.$executeRaw`
      INSERT INTO "number_sequences" ("id", "companyId", "scope", "branchId", "year", "lastValue")
      VALUES (gen_random_uuid()::text, ${key.companyId}, ${key.scope}::"SequenceScope",
              ${key.branchId}, ${key.year}, 1)
    `;

    return 1;
  }

  /**
   * `hashtext` to'qnashuvi (turli kalitlar bir xil hash) faqat ortiqcha kutishga olib keladi,
   * noto'g'ri raqamga emas — shuning uchun 32-bitlik hash yetarli.
   *
   * `$executeRaw` ataylab: `pg_advisory_xact_lock` `void` qaytaradi va Prisma uni
   * `$queryRaw` natijasi sifatida deserializatsiya qila olmaydi.
   */
  private async lock(tx: TenantTx, key: SequenceKey): Promise<void> {
    const token = `expense-seq:${key.companyId}:${key.scope}:${key.branchId ?? '-'}:${key.year}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${token}))`;
  }
}
