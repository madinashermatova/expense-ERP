import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Dropzone } from '@/components/ui/Dropzone';
<<<<<<< HEAD
import { useCreateRefund } from '../api';
import { MockService } from '@/mocks/mockService';
import styles from './RefundForm.module.css';

const refundSchema = z.object({
  expenseId: z.string().min(1, "Xarajatni tanlang"),
  amount: z.string().min(1, "Qaytarish summasini kiriting").refine(val => Number(val) > 0, "Summa musbat bo'lishi kerak"),
  reason: z.string().min(10, "Sabab kamida 10 ta belgidan iborat bo'lishi kerak"),
=======
import { Select } from '@/components/ui/Select';
import { useCreateRefund, useEmployeesForRefund, useApprovedExpensesForEmployee } from '../api';
import styles from './RefundForm.module.css';

const refundSchema = z.object({
  employeeId: z.string().min(1, 'Xodim majburiy'),
  expenseId: z.string().min(1, 'Xarajat majburiy'),
  amount: z.string().min(1, 'Summa majburiy').refine(val => Number(val) > 0, 'Musbat bo\'lishi kerak'),
  reason: z.string().min(10, 'Kamida 10 belgi'),
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
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

<<<<<<< HEAD
  // Available approved expenses for refund
  const expensesList = MockService.getExpenses({ limit: 50 }).items.filter(e => e.status === 'APPROVED' || e.status === 'ADMIN_PENDING');

=======
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RefundFormData>({
    resolver: zodResolver(refundSchema)
  });

<<<<<<< HEAD
  const selectedExpenseId = watch('expenseId');
  const enteredAmount = parseFloat(watch('amount') || '0');

  const selectedExpense = expensesList.find(e => e.id === selectedExpenseId);
  const maxRefundable = selectedExpense ? parseFloat(selectedExpense.amount) : 0;
  const isOverRemaining = enteredAmount > maxRefundable;
=======
  const watchEmployeeId = watch('employeeId');

  const { data: employees } = useEmployeesForRefund();
  const { data: approvedExpenses, isLoading: expensesLoading } = useApprovedExpensesForEmployee(watchEmployeeId);
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256

  const onSubmit = (data: RefundFormData) => {
    if (files.length === 0) {
      setFileError("Qaytarish cheki yoki bank kvitansiyasini yuklash majburiy!");
      return;
    }
    if (isOverRemaining) {
      alert(`Qaytarish summasi xarajat summasidan (${maxRefundable} UZS) oshishi mumkin emas!`);
      return;
    }
    setFileError(null);

    MockService.createRefund({
      expenseId: data.expenseId,
      expenseGlobalNumber: selectedExpense?.globalNumber || 'EXP-000101',
      branchId: selectedExpense?.branchId || 'b1',
      branchName: selectedExpense?.branchName || 'Filial',
      employeeName: selectedExpense?.createdByName || 'Xodim',
      amount: data.amount,
      originalAmount: selectedExpense?.amount || '0',
      isPartial: enteredAmount < maxRefundable,
      reason: data.reason,
      files: files.map(f => ({
        id: 'rf-' + Date.now(),
        name: f.name,
        url: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=80',
        size: f.size,
        type: f.type
      }))
    });

    onSuccess();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      <Select
<<<<<<< HEAD
        label="Asl xarajatni tanlang"
        required
=======
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
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
        error={errors.expenseId?.message}
        disabled={!watchEmployeeId || expensesLoading}
        {...register('expenseId')}
      >
        <option value="">Tanlang...</option>
<<<<<<< HEAD
        {expensesList.map(exp => (
          <option key={exp.id} value={exp.id}>
            {exp.globalNumber} — {exp.createdByName} ({new Intl.NumberFormat('uz-UZ').format(Number(exp.amount))} {exp.currency}) - {exp.categoryName}
          </option>
        ))}
      </Select>

      {selectedExpense && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'rgb(var(--muted))',
          fontSize: '12.5px',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span>Xarajat summasi:</span>
          <strong>{new Intl.NumberFormat('uz-UZ').format(Number(selectedExpense.amount))} {selectedExpense.currency}</strong>
        </div>
      )}

      <Input
        label="Qaytarilayotgan summa (UZS)"
        required
=======
        {approvedExpenses?.items?.map((exp: any) => (
          <option key={exp.id} value={exp.id}>
            {exp.globalNumber} - {new Intl.NumberFormat('uz-UZ').format(Number(exp.amount))} {exp.currency}
          </option>
        ))}
      </Select>
      <Input 
        label={t('form.amount')}
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
        type="number"
        step="0.01"
        placeholder="0.00"
        error={isOverRemaining ? `Summa xarajat summasidan (${maxRefundable}) oshmasligi kerak` : errors.amount?.message}
        {...register('amount')}
      />

      <Textarea
        label="Qaytarish sababi va asosi (Kamida 10 belgi)"
        required
        placeholder="Qoldiq mablag' nima sababdan qaytarilayotganini tushuntiring..."
        error={errors.reason?.message}
        {...register('reason')}
      />

      <div>
        <Dropzone
          label="Kassa cheki / Bank to'lov isboti (Majburiy)"
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
          Bekor qilish
        </Button>
        <Button type="submit" disabled={createMutation.isPending || isOverRemaining}>
          Qaytarishni yuborish
        </Button>
      </div>
    </form>
  );
};
