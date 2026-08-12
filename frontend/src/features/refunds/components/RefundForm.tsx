import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Dropzone } from '@/components/ui/Dropzone';
import { Select } from '@/components/ui/Select';
import { useCreateRefund, useEmployeesForRefund, useApprovedExpensesForEmployee } from '../api';
import styles from './RefundForm.module.css';

const refundSchema = z.object({
  employeeId: z.string().min(1, 'Xodim majburiy'),
  expenseId: z.string().min(1, 'Xarajat majburiy'),
  amount: z.string().min(1, 'Summa majburiy').refine(val => Number(val) > 0, 'Musbat bo\'lishi kerak'),
  reason: z.string().min(10, 'Kamida 10 belgi'),
});

type RefundFormData = z.infer<typeof refundSchema>;

interface RefundFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const RefundForm = ({ onSuccess, onCancel }: RefundFormProps) => {
  const { t } = useTranslation(['refunds', 'common']);
  const createMutation = useCreateRefund();
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RefundFormData>({
    resolver: zodResolver(refundSchema)
  });

  const watchEmployeeId = watch('employeeId');

  const { data: employees } = useEmployeesForRefund();
  const { data: approvedExpenses, isLoading: expensesLoading } = useApprovedExpensesForEmployee(watchEmployeeId);

  const onSubmit = (data: RefundFormData) => {
    if (files.length === 0) {
      setFileError(t('form.filesRequired'));
      return;
    }
    setFileError(null);

    const formData = new FormData();
    formData.append('expenseId', data.expenseId);
    formData.append('amount', data.amount);
    formData.append('reason', data.reason);
    files.forEach(f => formData.append('files', f));

    createMutation.mutate(formData, {
      onSuccess: () => {
        onSuccess();
      }
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <Select
        label="Xodimni tanlang"
        error={errors.employeeId?.message}
        {...register('employeeId')}
      >
        <option value="">Tanlang...</option>
        {employees?.items?.map((emp: any) => (
          <option key={emp.id} value={emp.id}>{emp.fullName}</option>
        ))}
      </Select>

      <Select
        label="Xarajatni tanlang (faqat tasdiqlanganlar)"
        error={errors.expenseId?.message}
        disabled={!watchEmployeeId || expensesLoading}
        {...register('expenseId')}
      >
        <option value="">Tanlang...</option>
        {approvedExpenses?.items?.map((exp: any) => (
          <option key={exp.id} value={exp.id}>
            {exp.globalNumber} - {new Intl.NumberFormat('uz-UZ').format(Number(exp.amount))} {exp.currency}
          </option>
        ))}
      </Select>
      <Input 
        label={t('form.amount')}
        type="number"
        step="0.01"
        error={errors.amount?.message}
        {...register('amount')}
      />
      <Textarea 
        label={t('form.reason')}
        error={errors.reason?.message}
        {...register('reason')}
      />
      
      <div>
        <Dropzone 
          label={t('form.files')}
          files={files}
          onChange={(newFiles) => {
            setFiles(newFiles);
            if (newFiles.length > 0) setFileError(null);
          }}
          error={fileError || undefined}
        />
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? t('common:status.loading') : t('common:actions.save')}
        </Button>
      </div>
    </form>
  );
};
