import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { usePendingExpenses, useApproveExpense, useRejectExpense } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Check, X, Eye } from 'lucide-react';
import styles from './ApprovalsPage.module.css';

export const ApprovalsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  
  const [activeTab, setActiveTab] = useState<'1' | '2'>('1');
  const { data, isLoading } = usePendingExpenses(activeTab);
  
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason });
    } else if (reason) {
      alert("Sabab kamida 10 belgi bo'lishi kerak!");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Tasdiqlash navbati</h1>
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
                    <Button variant="ghost" size="sm" title="Ko'rish" style={{ color: 'rgb(var(--info))' }}>
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
                <TableCell colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                  Tasdiqlash uchun xarajatlar yo'q
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
