import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCreateBranch } from '../api';

const schema = z.object({
  code: z.string().min(1, 'Kod majburiy'),
  name: z.string().min(1, 'Nomi majburiy'),
});

type FormData = z.infer<typeof schema>;

export const BranchForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const { t } = useTranslation(['settings', 'common']);
  const createMutation = useCreateBranch();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input label={t('branches.code')} error={errors.code?.message} {...register('code')} />
      <Input label={t('branches.name')} error={errors.name?.message} {...register('name')} />
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
        <Button type="button" variant="ghost" onClick={onCancel}>{t('common:actions.cancel')}</Button>
        <Button type="submit" disabled={createMutation.isPending}>{t('common:actions.save')}</Button>
      </div>
    </form>
  );
};
