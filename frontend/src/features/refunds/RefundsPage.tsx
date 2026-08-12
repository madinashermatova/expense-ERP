import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
import { Plus } from 'lucide-react';
import { useRefunds, useApproveRefund, useRejectRefund } from './api';
import { RefundForm } from './components/RefundForm';
import { Check, X } from 'lucide-react';
import styles from './RefundsPage.module.css';

export const RefundsPage = () => {
  const { t } = useTranslation(['refunds', 'common']);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const { data, isLoading } = useRefunds(activeTab);
  const approveMutation = useApproveRefund();
  const rejectMutation = useRejectRefund();

  const handleApprove = (id: string) => {
    approveMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Button style={{ gap: '8px' }} onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> {t('newRefund')}
        </Button>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'PENDING' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('PENDING')}
        >
          Kutilmoqda
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'APPROVED' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('APPROVED')}
        >
          Tasdiqlangan
        </button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.expenseId')}</TableHead>
            <TableHead>{t('columns.amount')}</TableHead>
            <TableHead>{t('columns.reason')}</TableHead>
            <TableHead>{t('columns.status')}</TableHead>
            <TableHead style={{ textAlign: 'right' }}>{t('columns.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                {t('common:status.loading')}
              </TableCell>
            </TableRow>
          ) : data?.items?.length > 0 ? (
            data.items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell style={{ fontFamily: 'monospace' }}>{item.expenseGlobalNumber}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('uz-UZ').format(Number(item.amount))}
                </TableCell>
                <TableCell>{item.reason}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  {item.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleApprove(item.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        style={{ color: 'rgb(var(--success))' }}
                      >
                        <Check size={18} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleReject(item.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        style={{ color: 'rgb(var(--destructive))' }}
                      >
                        <X size={18} />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                {t('common:status.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog 
        open={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
        title={t('newRefund')}
      >
        <RefundForm 
          onSuccess={() => setIsCreateOpen(false)} 
          onCancel={() => setIsCreateOpen(false)} 
        />
      </Dialog>
    </div>
  );
};
