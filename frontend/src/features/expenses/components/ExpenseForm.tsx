import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Dropzone } from '@/components/ui/Dropzone';
import { Dialog } from '@/components/ui/Dialog';
import { useBranches, useCategories, useEmployees } from '../api';
import { expenseSchema, ExpenseFormData } from '../schema';
import { useAuthStore } from '@/features/auth/store';
import { MockService } from '@/mocks/mockService';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Split, Users } from 'lucide-react';
import styles from './ExpenseForm.module.css';

interface ExpenseFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const ExpenseForm = ({ onSuccess, onCancel }: ExpenseFormProps) => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  const [attachments, setAttachments] = useState<File[]>([]);
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'MANUAL'>('EQUAL');
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [budgetToast, setBudgetToast] = useState(false);
  const [manualShares, setManualShares] = useState<Record<string, string>>({});
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [pendingFormData, setPendingFormData] = useState<any>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      branchId: isAdmin ? '' : user?.branchId || 'b1',
      employeeIds: [],
      shares: [],
      paymentMethod: 'CARD',
      date: new Date().toISOString().split('T')[0],
      amount: ''
    }
  });

  const watchBranchId = watch('branchId') || (isAdmin ? '' : user?.branchId || 'b1');
  const watchCategoryId = watch('categoryId');
  const watchAmount = watch('amount');

  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data: employees } = useEmployees(watchBranchId);

  // Selected category rules
  const selectedCat = categories?.find((c: any) => c.id === watchCategoryId) ||
    categories?.flatMap((c: any) => c.children || []).find((c: any) => c.id === watchCategoryId);

  const isReceiptMandatory = selectedCat?.receiptRequired;
  const isCommentMandatory = selectedCat?.commentRequired;
  const maxLimit = selectedCat?.maxAmountPerEntry;

  // Multi-employee toggle
  const toggleEmployee = (empId: string) => {
    let next: string[];
    if (selectedEmployees.includes(empId)) {
      next = selectedEmployees.filter(id => id !== empId);
    } else {
      next = [...selectedEmployees, empId];
    }
    setSelectedEmployees(next);
    setValue('employeeIds', next, { shouldValidate: true });
  };

  // Live shares calculation
  const totalAmount = parseFloat(watchAmount || '0') || 0;

  useEffect(() => {
    if (splitMode === 'EQUAL' && selectedEmployees.length > 0 && totalAmount > 0) {
      const count = selectedEmployees.length;
      const baseShare = Math.floor((totalAmount / count) * 100) / 100;
      const remainder = Math.round((totalAmount - (baseShare * count)) * 100) / 100;

      const calculated: Record<string, string> = {};
      selectedEmployees.forEach((id, idx) => {
        const val = idx === 0 ? (baseShare + remainder).toFixed(2) : baseShare.toFixed(2);
        calculated[id] = val;
      });
      setManualShares(calculated);
    }
  }, [splitMode, selectedEmployees, totalAmount]);

  // Manual sum checking
  const manualSum = Object.values(manualShares).reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
  const isSharesBalanced = selectedEmployees.length <= 1 || Math.abs(manualSum - totalAmount) < 0.01;
  const difference = (totalAmount - manualSum).toFixed(2);

  const handleManualShareChange = (empId: string, value: string) => {
    setManualShares(prev => ({
      ...prev,
      [empId]: value
    }));
  };

  const handleFinalSubmit = (data: any) => {
    // Format shares
    const finalShares = selectedEmployees.length > 0
      ? selectedEmployees.map(empId => {
          const emp = employees?.find((e: any) => e.id === empId);
          return {
            employeeId: empId,
            employeeName: emp?.fullName || empId,
            amount: manualShares[empId] || (totalAmount / selectedEmployees.length).toFixed(2)
          };
        })
      : [];

    MockService.createExpense({
      ...data,
      shares: finalShares,
      files: attachments.map(f => ({
        id: 'file-' + Date.now(),
        name: f.name,
        url: 'https://images.unsplash.com/photo-1554415707-9e49017a1430?w=600&auto=format&fit=crop&q=80',
        size: f.size,
        type: f.type
      })),
      currentUserId: user?.id,
      currentUserName: user?.fullName
    });

    if (totalAmount > 10000000) {
      setBudgetToast(true);
      setTimeout(() => {
        setBudgetToast(false);
        if (onSuccess) onSuccess();
      }, 2500);
    } else {
      if (onSuccess) onSuccess();
    }
  };

  const onSubmit = (data: ExpenseFormData) => {
    if (!isSharesBalanced) {
      alert("Taqsimlangan summalar yig'indisi jami summaga teng bo'lishi shart!");
      return;
    }

    if (isReceiptMandatory && attachments.length === 0) {
      alert("Ushbu kategoriya uchun kamida 1 ta chek yoki isbot fayli yuklash majburiy!");
      return;
    }

    // Check duplicate simulation (if amount > 5M)
    if (totalAmount > 5000000 && !duplicateModalOpen) {
      setPendingFormData(data);
      setDuplicateModalOpen(true);
      return;
    }

    handleFinalSubmit(data);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      {budgetToast && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius)',
          backgroundColor: 'rgb(var(--warning-subtle))',
          color: 'rgb(var(--warning-foreground))',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <AlertTriangle size={18} />
          Filial oylik limitining 92% qismi ishlatildi!
        </div>
      )}

      <div className={styles.grid}>
        {/* Branch */}
        <Select
          label="Filial"
          required
          disabled={!isAdmin}
          error={errors.branchId?.message}
          {...register('branchId')}
        >
          <option value="">Filialni tanlang...</option>
          {branches?.map((b: any) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </Select>

        {/* Category */}
        <Select
          label="Kategoriya"
          required
          error={errors.categoryId?.message}
          {...register('categoryId')}
        >
          <option value="">Kategoriyani tanlang...</option>
          {categories?.map((c: any) => (
            <React.Fragment key={c.id}>
              <option value={c.id} style={{ fontWeight: 700 }}>
                📁 {c.nameUz || c.name}
              </option>
              {c.children?.map((sub: any) => (
                <option key={sub.id} value={sub.id}>
                  &nbsp;&nbsp;&nbsp;↳ {sub.nameUz}
                </option>
              ))}
            </React.Fragment>
          ))}
        </Select>

        {/* Category Badge Hints */}
        {selectedCat && (
          <div className={styles.fullWidth} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '-8px' }}>
            {isReceiptMandatory && (
              <span style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgb(var(--primary-subtle))', color: 'rgb(var(--primary))', fontWeight: 600 }}>
                📑 Chek majburiy
              </span>
            )}
            {isCommentMandatory && (
              <span style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#d97706', fontWeight: 600 }}>
                ✍️ Izoh majburiy
              </span>
            )}
            {maxLimit && (
              <span style={{ fontSize: '11.5px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#059669', fontWeight: 600 }}>
                ⚖️ 1 martalik limit: {new Intl.NumberFormat('uz-UZ').format(maxLimit)} UZS
              </span>
            )}
          </div>
        )}

        {/* Amount */}
        <Input
          label="Summa (UZS)"
          required
          type="number"
          step="0.01"
          placeholder="0.00"
          error={errors.amount?.message}
          {...register('amount')}
        />

        {/* Date */}
        <Input
          label="Xarajat sanasi"
          type="date"
          required
          max={new Date().toISOString().split('T')[0]}
          error={errors.date?.message}
          {...register('date')}
        />

        {/* Payment Method */}
        <Select
          label="To'lov usuli"
          required
          error={errors.paymentMethod?.message}
          {...register('paymentMethod')}
        >
          <option value="CARD">💳 Plastik karta (Korporativ / Shaxsiy)</option>
          <option value="CASH">💵 Naqd pul</option>
          <option value="TRANSFER">🏦 Bank hisobidan o'tkazma</option>
        </Select>

        {/* Multi-employee selector pills */}
        <div className={styles.fullWidth}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'rgb(var(--foreground))' }}>
            Kim(lar) uchun kiritilmoqda:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {employees?.map((emp: any) => {
              const isSelected = selectedEmployees.includes(emp.id);
              return (
                <button
                  type="button"
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '999px',
                    border: isSelected ? '1.5px solid rgb(var(--primary))' : '1px solid rgb(var(--border))',
                    backgroundColor: isSelected ? 'rgb(var(--primary-subtle))' : 'rgb(var(--card))',
                    color: isSelected ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Users size={14} />
                  {emp.fullName}
                  {isSelected && <Check size={14} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-share calculator if > 1 employee */}
        {selectedEmployees.length > 1 && (
          <div className={`${styles.fullWidth} ${styles.distributionBox}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Split size={18} color="rgb(var(--primary))" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>
                  Xarajatni taqsimlash ({selectedEmployees.length} kishi)
                </h4>
              </div>

              {/* Mode switch */}
              <div style={{ display: 'flex', gap: '4px', background: 'rgb(var(--muted))', padding: '3px', borderRadius: '8px' }}>
                <button
                  type="button"
                  onClick={() => setSplitMode('EQUAL')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: splitMode === 'EQUAL' ? 'rgb(var(--card))' : 'transparent',
                    color: splitMode === 'EQUAL' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Teng bo'lish
                </button>
                <button
                  type="button"
                  onClick={() => setSplitMode('MANUAL')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: splitMode === 'MANUAL' ? 'rgb(var(--card))' : 'transparent',
                    color: splitMode === 'MANUAL' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Qo'lda kiritish
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedEmployees.map((empId) => {
                const emp = employees?.find((e: any) => e.id === empId);
                return (
                  <div key={empId} className={styles.distRow}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{emp?.fullName || empId}</span>
                    <div style={{ width: '160px' }}>
                      <Input
                        type="number"
                        step="0.01"
                        disabled={splitMode === 'EQUAL'}
                        value={manualShares[empId] || ''}
                        onChange={(e) => handleManualShareChange(empId, e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sum indicator */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid rgb(var(--border))',
              fontSize: '13px'
            }}>
              <span>Jami taqsimlangan: <strong>{manualSum.toFixed(2)} UZS</strong></span>
              {!isSharesBalanced ? (
                <span style={{ color: 'rgb(var(--destructive))', fontWeight: 700 }}>
                  Farq: {difference} UZS (Yig'indi teng emas!)
                </span>
              ) : (
                <span style={{ color: 'rgb(var(--success))', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={16} /> 100% Mos keldi
                </span>
              )}
            </div>
          </div>
        )}

        {/* Reason / Description */}
        <div className={styles.fullWidth}>
          <Textarea
            label={`Izoh va maqsadi ${isCommentMandatory ? '(Majburiy)' : ''}`}
            placeholder="Xarajat qanday maqsadda va nimalar xarid qilinganligi haqida batafsil ma'lumot..."
            required={isCommentMandatory}
            error={errors.reason?.message}
            {...register('reason')}
          />
        </div>

        {/* Dropzone */}
        <div className={styles.fullWidth}>
          <Dropzone
            label={`Chek / Isbot fayllari ${isReceiptMandatory ? '(Majburiy)' : ''}`}
            files={attachments}
            onChange={setAttachments}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Bekor qilish
        </Button>
        <Button type="submit" disabled={!isSharesBalanced}>
          Arizani yuborish
        </Button>
      </div>

      {/* Duplicate Warning Modal */}
      <Dialog
        open={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        title="Dublikat ogohlantirishi"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#d97706' }}>
            <AlertTriangle size={32} />
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgb(var(--foreground))' }}>
              Shunga o'xshash xarajat 10 daqiqa oldin kiritilgan. Davom etasizmi?
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Kompaniya tizimida adashib bir xil arizani ikki marta yuborishni oldini olish maqsadida ushbu ogohlantirish ko'rsatilmoqda.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" onClick={() => setDuplicateModalOpen(false)}>
              Yo'q, bekor qilish
            </Button>
            <Button
              onClick={() => {
                setDuplicateModalOpen(false);
                if (pendingFormData) handleFinalSubmit(pendingFormData);
              }}
            >
              Ha, davom etish
            </Button>
          </div>
        </div>
      </Dialog>
    </form>
  );
};
