import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useCreateBudget } from '../api';
import { useBranches, useCategories } from '@/features/expenses/api';

const schema = z.object({
  scopeType: z.enum(['BRANCH', 'CATEGORY', 'EMPLOYEE']),
  scopeId: z.string().min(1, 'Tanlash majburiy'),
  period: z.string().min(4, 'Davr majburiy (masalan, 2026-08)'),
  amountLimit: z.string().min(1, 'Limit majburiy'),
});

type FormData = z.infer<typeof schema>;

export const BudgetForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateBudget();
  const { data: branches } = useBranches();
  const { data: categories } = useCategories();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { scopeType: 'CATEGORY' }
  });
  
  const scopeType = watch('scopeType');

  const onSubmit = (data: FormData) => {
    createMutation.mutate({ ...data, amountLimit: Number(data.amountLimit) }, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Select label={t('budgets.scope')} {...register('scopeType')}>
        <option value="CATEGORY">Kategoriya</option>
        <option value="BRANCH">Filial</option>
        <option value="EMPLOYEE">Xodim</option>
      </Select>

      <Select label="Obyekt (ID/Nomi)" error={errors.scopeId?.message} {...register('scopeId')}>
        <option value="">-- Tanlang --</option>
        {scopeType === 'CATEGORY' && categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        {scopeType === 'BRANCH' && branches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        {scopeType === 'EMPLOYEE' && <option value="e1">Mavjud xodimlar...</option>}
      </Select>

      <Input label={t('budgets.period')} placeholder="YYYY-MM" error={errors.period?.message} {...register('period')} />
      <Input label={t('budgets.limit')} type="number" step="1000" error={errors.amountLimit?.message} {...register('amountLimit')} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
