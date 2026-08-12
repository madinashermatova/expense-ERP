import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateCurrency } from '../api';

const schema = z.object({
  currency: z.string().min(3, 'Valyuta majburiy (masalan: USD)'),
  rate: z.string().min(1, 'Kurs majburiy'),
  date: z.string().min(1, 'Sana majburiy'),
});

type FormData = z.infer<typeof schema>;

export const CurrencyForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateCurrency();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      currency: 'USD'
    }
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate({ ...data, rate: Number(data.rate) }, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label={t('currencies.date')} type="date" error={errors.date?.message} {...register('date')} />
      <Input label={t('currencies.currency')} error={errors.currency?.message} {...register('currency')} />
      <Input label={t('currencies.rate')} type="number" step="0.01" error={errors.rate?.message} {...register('rate')} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
