import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Dropzone } from '@/components/ui/Dropzone';
import { useBranches, useCategories, useEmployees } from '../api';
import { expenseSchema, ExpenseFormData } from '../schema';
import { useAuthStore } from '@/features/auth/store';
import styles from './ExpenseForm.module.css';

interface ExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ExpenseForm = ({ onSuccess, onCancel }: ExpenseFormProps) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  const [attachments, setAttachments] = useState<File[]>([]);

  const { register, handleSubmit, watch, setValue, control, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      branchId: isAdmin ? '' : user?.branchId || '',
      employeeIds: [],
      shares: [],
      paymentMethod: 'CARD',
      date: new Date().toISOString().split('T')[0]
    }
  });

  const { fields: shareFields, append, remove, replace } = useFieldArray({
    control,
    name: "shares"
  });

  const watchBranchId = watch('branchId');
  const watchAmount = watch('amount');
  const watchEmployeeIds = watch('employeeIds') || [];

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data: employees } = useEmployees(watchBranchId);

  // Auto-distribute shares when employeeIds or amount changes
  useEffect(() => {
    if (watchEmployeeIds.length > 1 && watchAmount) {
      const amountNum = parseFloat(watchAmount);
      if (!isNaN(amountNum)) {
        const share = Math.floor((amountNum / watchEmployeeIds.length) * 100) / 100;
        const remainder = Math.round((amountNum - (share * watchEmployeeIds.length)) * 100) / 100;
        
        replace(watchEmployeeIds.map((empId, index) => ({
          employeeId: empId,
          amount: index === 0 ? (share + remainder).toFixed(2) : share.toFixed(2)
        })));
      }
    } else {
      replace([]); // Clear shares if 1 or 0 employees
    }
  }, [watchEmployeeIds, watchAmount, replace]);

  // Handle multi-select change manually for simple select
  const handleEmployeeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.options);
    const selected = options.filter(opt => opt.selected).map(opt => opt.value);
    setValue('employeeIds', selected, { shouldValidate: true });
  };

  const onSubmit = (data: ExpenseFormData) => {
    console.log('Submitting', { ...data, attachments });
    // TODO: Mutation (with FormData if attachments exist)
    if (onSuccess) onSuccess();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.grid}>
        
        <Select
          label="Filial"
          required
          disabled={!isAdmin}
          error={errors.branchId?.message}
          {...register('branchId')}
        >
          <option value="">Tanlang...</option>
          {branches?.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>

        <Select
          label="Kategoriya"
          required
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          <option value="">Tanlang...</option>
          {categories?.map((c: any) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>

        <div className={styles.fullWidth}>
          <Select
            label="Kim uchun (Ctrl/Cmd bilan bir nechta tanlash mumkin)"
            required
            multiple
            size={4}
            error={errors.employeeIds?.message}
            onChange={handleEmployeeChange}
            value={watchEmployeeIds}
          >
            {employees?.map((e: any) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </div>

        <Input
          label="Summa"
          required
          placeholder="0.00"
          error={errors.amount?.message}
          {...register('amount')}
        />

        <Input
          label="Sana"
          type="date"
          required
          error={errors.date?.message}
          {...register('date')}
        />

        <Select
          label="To'lov usuli"
          required
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        >
          <option value="CARD">Plastik karta</option>
          <option value="CASH">Naqd pul</option>
          <option value="TRANSFER">Pul o'tkazmasi</option>
        </Select>
        
        <div className={styles.fullWidth}>
          <Textarea
            label="Izoh"
            placeholder="Xarajat haqida ma'lumot..."
            error={errors.reason?.message}
            {...register('reason')}
          />
        </div>

        <div className={styles.fullWidth}>
          <Dropzone
            label="Chek / Isbot fayllar"
            files={attachments}
            onChange={setAttachments}
          />
        </div>

        {shareFields.length > 0 && (
          <div className={`${styles.fullWidth} ${styles.distributionBox}`}>
            <h4 style={{ marginBottom: '12px' }}>Taqsimlash</h4>
            {shareFields.map((field, index) => {
              const emp = employees?.find((e: any) => e.id === field.employeeId);
              return (
                <div key={field.id} className={styles.distRow}>
                  <span>{emp?.fullName || field.employeeId}</span>
                  <div style={{ width: '150px' }}>
                    <Input
                      {...register(`shares.${index}.amount` as const)}
                      error={errors.shares?.[index]?.amount?.message}
                    />
                  </div>
                </div>
              );
            })}
            {errors.shares?.message && (
              <div style={{ color: 'rgb(var(--destructive))', fontSize: '12px', marginTop: '8px' }}>
                {errors.shares.message}
              </div>
            )}
          </div>
        )}
        
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>Bekor qilish</Button>
        <Button type="submit">Saqlash</Button>
      </div>
    </form>
  );
};
