import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCategory } from '../api';

const schema = z.object({
  name: z.string().min(1, 'Nomi majburiy'),
  maxAmountPerEntry: z.string().optional(),
  receiptRequired: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

export const CategoryForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateCategory();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({
      ...data,
      maxAmountPerEntry: data.maxAmountPerEntry ? Number(data.maxAmountPerEntry) : null
    }, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label={t('categories.name')} error={errors.name?.message} {...register('name')} />
      <Input label={t('categories.limit')} type="number" step="100" error={errors.maxAmountPerEntry?.message} {...register('maxAmountPerEntry')} />
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" {...register('receiptRequired')} />
        <span>{t('categories.receiptRequired')}</span>
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
