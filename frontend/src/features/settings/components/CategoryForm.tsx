import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCategory } from '@/features/categories/api';
import { categorySchema, CategoryFormData, CategoryFormInput } from '@/features/categories/schema';

export const CategoryForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateCategory();

  const { register, handleSubmit, formState: { errors } } = useForm<CategoryFormInput, unknown, CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nameUz: '',
      nameRu: '',
      receiptRequired: false,
      commentRequired: false
    }
  });

  const onSubmit = (data: CategoryFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label="Nomi (O'zbekcha)" error={errors.nameUz?.message} {...register('nameUz')} />
      <Input label="Nomi (Ruscha)" error={errors.nameRu?.message} {...register('nameRu')} />
      <Input label="Limit (UZS)" type="number" step="100" error={errors.maxAmountPerEntry?.message} {...register('maxAmountPerEntry', { valueAsNumber: true })} />
      
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" {...register('receiptRequired')} />
        <span>Chek talab qilinsin</span>
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" {...register('commentRequired')} />
        <span>Izoh talab qilinsin</span>
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
