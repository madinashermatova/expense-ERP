import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateEmployee, useUpdateEmployee } from '../api';
import { employeeSchema, EmployeeFormData, Employee } from '../schema';
import { useBranches } from '@/features/branches/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/features/auth/store';

interface EmployeeFormDialogProps {
  open: boolean;
  onClose: () => void;
  employeeToEdit?: Employee | null;
  onSuccessCreate?: (password: string) => void;
}

export const EmployeeFormDialog = ({ open, onClose, employeeToEdit, onSuccessCreate }: EmployeeFormDialogProps) => {
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      role: 'WORKER'
    }
  });

  const { data: branches } = useBranches('active');
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  
  const { user } = useAuthStore();
  const isDirector = user?.role === 'DIRECTOR';

  useEffect(() => {
    if (open) {
      if (employeeToEdit) {
        setValue('fullName', employeeToEdit.fullName);
        setValue('email', employeeToEdit.email);
        setValue('role', employeeToEdit.role);
        setValue('branchId', employeeToEdit.branchId);
        setValue('username', employeeToEdit.username || '');
        setValue('position', employeeToEdit.position || '');
        setValue('phone', employeeToEdit.phone || '');
        setValue('hiredAt', employeeToEdit.hiredAt ? employeeToEdit.hiredAt.substring(0, 10) : '');
      } else {
        reset();
        if (isDirector && user?.branchId) {
          setValue('branchId', user.branchId);
          setValue('role', 'WORKER');
        }
      }
    }
  }, [open, employeeToEdit, setValue, reset, isDirector, user]);

  const onSubmit = (data: EmployeeFormData) => {
    if (employeeToEdit) {
      updateMutation.mutate(
        { id: employeeToEdit.id, data },
        {
          onSuccess: () => {
            toast.success("Xodim ma'lumotlari yangilandi");
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: (res) => {
          if (onSuccessCreate && res.tempPassword) {
            onSuccessCreate(res.tempPassword);
          }
          onClose();
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      title={employeeToEdit ? "Xodimni tahrirlash" : "Yangi xodim qo'shish"}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="F.I.Sh."
          placeholder="Ism Familiya"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        
        <Input
          label="Email (tizimga kirish uchun)"
          type="email"
          placeholder="email@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Username (ixtiyoriy)"
          placeholder="username123"
          error={errors.username?.message}
          {...register('username')}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500' }}>Rol</label>
          <select 
            {...register('role')}
            disabled={isDirector}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgb(var(--border))' }}
          >
            <option value="WORKER">Xodim (WORKER)</option>
            {!isDirector && <option value="DIRECTOR">Direktor (DIRECTOR)</option>}
            {!isDirector && <option value="ADMIN">Administrator (ADMIN)</option>}
          </select>
          {errors.role && <span style={{ color: 'red', fontSize: '12px' }}>{errors.role.message}</span>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '14px', fontWeight: '500' }}>Filial</label>
          <select 
            {...register('branchId')}
            disabled={isDirector}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid rgb(var(--border))' }}
          >
            <option value="">Filialni tanlang...</option>
            {branches?.filter(b => isDirector ? b.id === user?.branchId : true).map(b => (
              <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
            ))}
          </select>
          {errors.branchId && <span style={{ color: 'red', fontSize: '12px' }}>{errors.branchId.message}</span>}
        </div>

        <Input
          label="Lavozim (ixtiyoriy)"
          placeholder="Menejer"
          error={errors.position?.message}
          {...register('position')}
        />

        <Input
          label="Telefon (ixtiyoriy)"
          placeholder="+998901234567"
          error={errors.phone?.message}
          {...register('phone')}
        />

        <Input
          label="Ishga olingan sana"
          type="date"
          error={errors.hiredAt?.message}
          {...register('hiredAt')}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
