import { z } from 'zod';

export const categorySchema = z.object({
  nameUz: z.string().min(1, { message: 'Nom kiritilishi shart (UZ)' }),
  nameRu: z.string().min(1, { message: 'Nom kiritilishi shart (RU)' }),
  parentId: z.string().nullable().optional(),
  receiptRequired: z.boolean().default(false),
  commentRequired: z.boolean().default(false),
  maxAmountPerEntry: z.number().nullable().optional(),
});

export const updateCategorySchema = categorySchema.partial();

export type CategoryFormData = z.infer<typeof categorySchema>;
export type UpdateCategoryFormData = z.infer<typeof updateCategorySchema>;

export interface Category {
  id: string;
  nameUz: string;
  nameRu: string;
  parentId: string | null;
  receiptRequired: boolean;
  commentRequired: boolean;
  maxAmountPerEntry: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  children?: Category[];
}
