import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSettings, useUpdateSettings, SettingsView } from './api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import toast from 'react-hot-toast';

export const SettingsPage = () => {
  const { t } = useTranslation(['settings', 'common']);
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();

  const { register, handleSubmit, reset } = useForm<SettingsView>();

  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  const onSubmit = (data: SettingsView) => {
    // Array handling for workDays if needed, right now we assume it is correctly bound
    // We parse strings to numbers where necessary
    const payload = {
      ...data,
      reportPeriodStartDay: Number(data.reportPeriodStartDay),
      approvalReminderHours: Number(data.approvalReminderHours),
      expenseEditWindowHours: Number(data.expenseEditWindowHours),
    };

    updateMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t('common:status.success'));
      },
      onError: () => {
        toast.error(t('common:status.error'));
      }
    });
  };

  if (isLoading) return <div>{t('common:status.loading')}</div>;

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Kompaniya sozlamalari</h1>

      <Card>
        <CardHeader>
          <CardTitle>Asosiy parametrlar</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Select label="Valyuta bazasi" {...register('currencyBase')}>
              <option value="CBU">Markaziy bank (CBU)</option>
              <option value="MANUAL">Qo'lda kiritish</option>
            </Select>

            <Input 
              type="number" 
              label="Hisobot davri boshlanish kuni (1-28)" 
              {...register('reportPeriodStartDay')} 
              min={1} max={28} 
            />

            <Input 
              type="number" 
              label="Tasdiqlash eslatmasi (soat)" 
              {...register('approvalReminderHours')} 
              min={1} 
            />

            <Input 
              type="number" 
              label="Tahrirlash oynasi (soat)" 
              {...register('expenseEditWindowHours')} 
              min={0} 
            />

            <Select label="Standart til" {...register('defaultLanguage')}>
              <option value="uz">O'zbekcha</option>
              <option value="ru">Русский</option>
            </Select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="notificationsEnabled" {...register('notificationsEnabled')} />
              <label htmlFor="notificationsEnabled">Bildirishnomalar yoniq</label>
            </div>

            <Button type="submit" disabled={updateMutation.isPending} style={{ alignSelf: 'flex-start', marginTop: '16px' }}>
              {updateMutation.isPending ? t('common:status.loading') : 'Saqlash'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
