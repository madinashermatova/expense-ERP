/**
 * `companyId` ni Prisma `create` ma'lumotidan chiqarib tashlaydi.
 *
 * Tenant extension `companyId` ni runtime da avtomatik to'ldiradi (TZ 3.16.1), lekin
 * Prisma ning generatsiya qilingan tiplari uni majburiy deb biladi. Bu yordamchi
 * aynan shu bitta maydonni tipdan olib tashlaydi — qolgan barcha maydonlar
 * to'liq tekshirilishda qoladi, ya'ni `as any` dan farqli o'laroq tip xavfsizligi yo'qolmaydi.
 *
 * Ishlatilishi:
 *   data: tenantData<Prisma.ExpenseFileUncheckedCreateInput>({ expenseId, storageKey, ... })
 */
export function tenantData<T extends { companyId: string }>(
  data: Omit<T, 'companyId'>,
): T {
  return data as T;
}
