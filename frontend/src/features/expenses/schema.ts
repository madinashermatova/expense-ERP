import { z } from 'zod';

export const expenseSchema = z.object({
  branchId: z.string().min(1, "Filial tanlash majburiy"),
  categoryId: z.string().min(1, "Kategoriya tanlash majburiy"),
  employeeIds: z.array(z.string()).min(1, "Kamida bitta xodim tanlanishi kerak"),
  amount: z.string().min(1, "Summani kiriting").regex(/^\d+(\.\d{1,2})?$/, "Noto'g'ri summa formati"),
  date: z.string().min(1, "Sanani kiriting"),
  currency: z.enum(['UZS', 'USD'], { required_error: "Valyutani tanlang" }),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER'], { required_error: "To'lov usulini tanlang" }),
  comment: z.string().optional(),
  shares: z.array(
    z.object({
      employeeId: z.string(),
      amount: z.string()
    })
  ).optional()
}).superRefine((data, ctx) => {
  // Check shares sum if there are shares
  if (data.shares && data.shares.length > 0) {
    const totalShare = data.shares.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
    if (Math.abs(totalShare - Number(data.amount)) > 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Taqsimlangan summalar yig'indisi umumiy summaga teng bo'lishi kerak",
        path: ['shares']
      });
    }
  }
});

export type ExpenseFormData = z.infer<typeof expenseSchema>;
