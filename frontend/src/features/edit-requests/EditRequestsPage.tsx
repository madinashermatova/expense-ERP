import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { useEditRequests, useApplyEditRequest, useRejectEditRequest } from './api';
import styles from './EditRequestsPage.module.css';

export const EditRequestsPage = () => {
  const { t } = useTranslation(['editRequests', 'common']);
  const [activeTab, setActiveTab] = useState('PENDING');

  const { data, isLoading } = useEditRequests(activeTab);
  const applyMutation = useApplyEditRequest();
  const rejectMutation = useRejectEditRequest();

  const handleApply = (id: string) => {
    // According to TZ: Qo'llash bosilsa xarajat formasi ochiladi. 
    // Hozircha oddiy mutation orqali tasdiqlab ketamiz mock sifatida.
    applyMutation.mutate(id);
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Rad etish sababi:");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', borderBottom: '1px solid rgb(var(--border))' }}>
        <button 
          onClick={() => setActiveTab('PENDING')}
          style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'PENDING' ? 'rgb(var(--primary))' : 'transparent'}`, color: activeTab === 'PENDING' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))', fontWeight: 500, cursor: 'pointer' }}
        >
          Kutilmoqda
        </button>
        <button 
          onClick={() => setActiveTab('RESOLVED')}
          style={{ padding: '12px 24px', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === 'RESOLVED' ? 'rgb(var(--primary))' : 'transparent'}`, color: activeTab === 'RESOLVED' ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))', fontWeight: 500, cursor: 'pointer' }}
        >
          Hal qilingan
        </button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('columns.expenseId')}</TableHead>
            <TableHead>{t('columns.requestedBy')}</TableHead>
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
                <TableCell>{item.requestedBy}</TableCell>
                <TableCell>{item.reason}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  {activeTab === 'PENDING' && (
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" onClick={() => handleApply(item.id)}>{t('common:actions.apply')}</Button>
                      <Button variant="ghost" size="sm" style={{ color: 'rgb(var(--destructive))' }} onClick={() => handleReject(item.id)}>{t('common:actions.reject')}</Button>
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
    </div>
  );
};
