import { z } from 'zod';

export const branchSchema = z.object({
  code: z.string().regex(/^[A-Z]{2,5}$/, { message: 'Kod faqat 2-5 ta katta lotin harflaridan iborat bo\'lishi kerak' }),
  name: z.string().min(1, { message: 'Nom bo\'sh bo\'lishi mumkin emas' }),
  address: z.string().optional(),
  phone: z.string().optional(),
  openedAt: z.string().optional(),
});

export const updateBranchSchema = branchSchema.omit({ code: true });

export type BranchFormData = z.infer<typeof branchSchema>;
export type UpdateBranchFormData = z.infer<typeof updateBranchSchema>;

export type BranchStatus = 'ACTIVE' | 'ARCHIVED';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string;
  phone?: string;
  status: BranchStatus;
  openedAt?: string;
  // Boshqa qo'shimcha maydonlar (masalan: xodimlar soni, byudjet holati kelishi mumkin)
  _count?: {
    employees: number;
  };
}
