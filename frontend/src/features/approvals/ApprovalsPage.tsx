import React from 'react';
import { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { usePendingExpenses, useApproveExpense, useRejectExpense, useBulkApproveExpenses } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Check, X, Eye, AlertCircle } from 'lucide-react';
import styles from './ApprovalsPage.module.css';
import { Dialog } from '@/components/ui/Dialog';

import { ExpenseDetailModal } from './components/ExpenseDetailModal';

export const ApprovalsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  
  const [activeTab, setActiveTab] = useState<'1' | '2'>('1');
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  const { data, isLoading } = usePendingExpenses(activeTab);
  
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();
  const bulkApproveMutation = useBulkApproveExpenses();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkErrors, setBulkErrors] = useState<any[]>([]);

  // Reset selection when tab changes
  React.useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const handleApprove = React.useCallback((id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => setSelectedExpense(null)
    });
  }, [approveMutation]);

  const handleReject = React.useCallback((id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason }, {
        onSuccess: () => setSelectedExpense(null)
      });
    } else if (reason) {
      alert("Sabab kamida 10 belgi bo'lishi kerak!");
    }
  }, [rejectMutation]);

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setBulkErrors([]);
    bulkApproveMutation.mutate(selectedIds, {
      onSuccess: (data: any) => {
        // qisman xatolar bo'lsa
        if (data?.errors && data.errors.length > 0) {
          setBulkErrors(data.errors);
        } else {
          setSelectedIds([]);
        }
        setSelectedExpense(null);
      },
      onError: (err: any) => {
        if (err?.response?.data?.details) {
          setBulkErrors(err.response.data.details);
        }
      }
    });
  };

  // Keyboard navigation for A (Approve) and R (Reject)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Faqatgina modal ochiq va input maydonida bo'lmaganda ishlaydi
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!selectedExpense) return;

      if (e.key.toLowerCase() === 'a') {
        handleApprove(selectedExpense.id);
      } else if (e.key.toLowerCase() === 'r') {
        handleReject(selectedExpense.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedExpense, handleApprove, handleReject]);

  const toggleSelectAll = () => {
    if (data?.items) {
      if (selectedIds.length === data.items.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(data.items.map((item: any) => item.id));
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedTotal = data?.items
    ?.filter((item: any) => selectedIds.includes(item.id))
    .reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasdiqlash navbati</h1>
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontWeight: 'bold' }}>
              Tanlanganlar: {selectedIds.length} ta ( {new Intl.NumberFormat('uz-UZ').format(selectedTotal)} UZS )
            </div>
            <Button onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending}>
              {bulkApproveMutation.isPending ? 'Tasdiqlanmoqda...' : 'Tanlanganlarni tasdiqlash'}
            </Button>
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === '1' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('1')}
        >
          1-bosqich (Direktor kutmoqda)
        </button>
        {isAdmin && (
          <button 
            className={`${styles.tab} ${activeTab === '2' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('2')}
          >
            2-bosqich (Admin kutmoqda)
          </button>
        )}
      </div>

      {isLoading ? (
        <div>Yuklanmoqda...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={data?.items?.length > 0 && selectedIds.length === data?.items?.length}
                  onChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Raqam</TableHead>
              <TableHead>Sana</TableHead>
              <TableHead>Kategoriya</TableHead>
              <TableHead>Xodim</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Summa</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <div style={{ fontFamily: 'monospace' }}>{item.globalNumber}</div>
                </TableCell>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.category.name}</TableCell>
                <TableCell>{item.employees?.[0]?.fullName} {item.employees?.length > 1 ? `(+${item.employees.length - 1})` : ''}</TableCell>
                <TableCell>
                  <div className={styles.amount}>
                    {new Intl.NumberFormat('uz-UZ').format(Number(item.amount))} {item.currency}
                  </div>
                </TableCell>
                <TableCell>
                  <div className={styles.actions}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedExpense(item)}
                      title="Ko'rish" 
                      style={{ color: 'rgb(var(--info))' }}
                    >
                      <Eye size={18} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleApprove(item.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      style={{ color: 'rgb(var(--success))' }}
                      title="Tasdiqlash"
                    >
                      <Check size={18} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleReject(item.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      style={{ color: 'rgb(var(--destructive))' }}
                      title="Rad etish"
                    >
                      <X size={18} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!data?.items || data.items.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                  Tasdiqlash uchun xarajatlar yo'q
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <ExpenseDetailModal
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        isPending={approveMutation.isPending || rejectMutation.isPending}
      />

      <Dialog open={bulkErrors.length > 0} onClose={() => setBulkErrors([])} title="Ommaviy tasdiqlash xatolari">
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: 'rgb(var(--destructive))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>Ba'zi xarajatlarni tasdiqlashda xatolik yuz berdi:</span>
          </div>
          <ul style={{ paddingLeft: '1.5rem', listStyle: 'disc' }}>
            {bulkErrors.map((err, i) => (
              <li key={i} style={{ marginBottom: '0.5rem' }}>
                <b>{err.globalNumber || err.id || 'Noma\'lum xarajat'}:</b> {err.message || 'Xatolik yuz berdi'}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setBulkErrors([])}>Yopish</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
