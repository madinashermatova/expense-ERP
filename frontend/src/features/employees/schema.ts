import { z } from 'zod';

export const employeeRoleSchema = z.enum(['ADMIN', 'DIRECTOR', 'WORKER']);

export const employeeSchema = z.object({
  fullName: z.string().min(1, { message: 'F.I.Sh kiritilishi shart' }),
  email: z.string().email({ message: "Noto'g'ri email formati" }),
  role: employeeRoleSchema,
  branchId: z.string().min(1, { message: 'Filialni tanlang' }),
  username: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(), // validatsiya ^+998 qo'shish mumkin
  hiredAt: z.string().optional(),
});

export const updateEmployeeSchema = employeeSchema.partial();

export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type UpdateEmployeeFormData = z.infer<typeof updateEmployeeSchema>;

export interface Employee {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'DIRECTOR' | 'WORKER';
  branchId: string;
  username?: string;
  position?: string;
  phone?: string;
  hiredAt?: string;
  isActive: boolean;
  botBlocked?: boolean;
}
