import React from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileText, Download } from 'lucide-react';
import styles from './ExpenseDetailModal.module.css';

interface ExpenseDetailModalProps {
  expense: any;
  open: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isPending: boolean;
}

export const ExpenseDetailModal = ({ expense, open, onClose, onApprove, onReject, isPending }: ExpenseDetailModalProps) => {


  const handleApprove = React.useCallback(() => {
    if (expense) onApprove(expense.id);
  }, [expense, onApprove]);

  const handleReject = React.useCallback(() => {
    if (expense) onReject(expense.id);
  }, [expense, onReject]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in prompt
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key.toLowerCase() === 'a') {
        handleApprove();
      } else if (e.key.toLowerCase() === 'r') {
        handleReject();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleApprove, handleReject]);

  if (!expense) return null;

  return (
    <Dialog open={open} onClose={onClose} title={`Xarajat: ${expense.globalNumber}`}>
      <div className={styles.grid}>
        <div className={styles.col}>
          <div className={styles.item}>
            <span className={styles.label}>Filial</span>
            <span className={styles.value}>{expense.branch?.name}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Kategoriya</span>
            <span className={styles.value}>{expense.category?.name}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Xodim(lar)</span>
            <span className={styles.value}>
              {expense.employees?.map((e: any) => e.fullName).join(', ')}
            </span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Sana</span>
            <span className={styles.value}>{expense.date}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>To'lov usuli</span>
            <span className={styles.value}>{expense.paymentMethod}</span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Summa</span>
            <span className={styles.value} style={{ fontSize: '18px', fontWeight: 600 }}>
              {new Intl.NumberFormat('uz-UZ').format(Number(expense.amount))} {expense.currency}
            </span>
          </div>
          <div className={styles.item}>
            <span className={styles.label}>Holat</span>
            <div><StatusBadge status={expense.status} /></div>
          </div>
        </div>

        <div className={styles.col}>
          <div className={styles.item}>
            <span className={styles.label}>Chek / Isbot</span>
            {expense.hasReceipt ? (
              <div className={styles.receiptBox}>
                <FileText size={32} color="rgb(var(--primary))" />
                <span>chek_nusxasi.pdf</span>
                <Button variant="ghost" size="sm"><Download size={16} /></Button>
              </div>
            ) : (
              <span className={styles.value}>Yuklanmagan</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={onClose} disabled={isPending}>Yopish</Button>
        <Button 
          style={{ backgroundColor: 'rgb(var(--destructive))', color: 'rgb(var(--destructive-foreground))' }} 
          onClick={handleReject}
          disabled={isPending}
        >
          Rad etish
        </Button>
        <Button 
          style={{ backgroundColor: 'rgb(var(--success))', color: 'rgb(var(--success-foreground))' }}
          onClick={handleApprove}
          disabled={isPending}
        >
          Tasdiqlash
        </Button>
      </div>
    </Dialog>
  );
};
