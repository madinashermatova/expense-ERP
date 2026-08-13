import { z } from 'zod';

export const branchSchema = z.object({
  code: z
    .string()
    .min(2, { message: "Filial kodi kamida 2 ta harfdan iborat bo'lishi kerak" })
    .max(5, { message: "Filial kodi 5 ta harfdan oshmasligi kerak" })
    .regex(/^[A-Z]{2,5}$/, { message: "Kod faqat 2-5 ta katta lotin harflaridan iborat bo'lishi shart (masalan: CHL, YUN)" }),
  name: z
    .string()
    .min(2, { message: "Nom kamida 2 ta belgidan iborat bo'lishi kerak" })
    .max(120, { message: "Nom 120 ta belgidan oshmasligi kerak" }),
  address: z.string().max(255).optional().or(z.literal('')),
  phone: z
    .string()
    .regex(/^(\+998\d{9})?$/, { message: 'Telefon formati: +998901234567' })
    .optional()
    .or(z.literal('')),
  openedAt: z.string().optional().or(z.literal('')),
});

export const updateBranchSchema = branchSchema.omit({ code: true });

export type BranchFormData = z.infer<typeof branchSchema>;
export type UpdateBranchFormData = z.infer<typeof updateBranchSchema>;

export type BranchStatus = 'ACTIVE' | 'ARCHIVED';

export interface Branch {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  openedAt?: string | null;
  status: BranchStatus;
  employeeCount: number;
  directorCount: number;
  hasNoDirector?: boolean;
  directorName?: string | null;
  monthlySpend?: number;
  monthlyLimit?: number;
  createdAt?: string;
}

export interface BranchQueryParams {
  status?: 'active' | 'archived' | 'all';
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
