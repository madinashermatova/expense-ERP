import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useCreateEmployee } from '../api';
import { useBranches } from '@/features/expenses/api';

const schema = z.object({
  fullName: z.string().min(1, 'F.I.O majburiy'),
  login: z.string().min(4, 'Kamida 4 belgi'),
  role: z.enum(['WORKER', 'ACCOUNTANT', 'DIRECTOR', 'ADMIN', 'PLATFORM_OWNER']),
  branchId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export const EmployeeForm = ({ onSuccess, onCancel }: { onSuccess: (pass?: string) => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateEmployee();
  const { data: branches } = useBranches();

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'WORKER' }
  });
  const role = watch('role');

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data, {
      onSuccess: (res) => {
        // Mock the response if necessary
        onSuccess(res.tempPassword || 'tmp123XYZ');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label={t('employees.fullName')} error={errors.fullName?.message} {...register('fullName')} />
      <Input label="Login" error={errors.login?.message} {...register('login')} />
      
      <Select 
        label={t('employees.role')} 
        value={role} 
        onChange={(e) => setValue('role', e.target.value as any)}
      >
        <option value="WORKER">Xodim (Worker)</option>
        <option value="ACCOUNTANT">Buxgalter (Accountant)</option>
        <option value="DIRECTOR">Direktor (Director)</option>
        <option value="ADMIN">Admin (Admin)</option>
      </Select>

      <Select 
        label={t('employees.branch')} 
        error={errors.branchId?.message}
        {...register('branchId')}
      >
        <option value="">-- Tanlang --</option>
        {branches?.map((b: any) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </Select>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
