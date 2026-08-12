import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useAuditLogs } from './api';
import styles from './AuditPage.module.css';

export const AuditPage = () => {
  const { t } = useTranslation(['audit', 'common']);
  const { data: logs, isLoading } = useAuditLogs();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
      </div>

      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.date')}</TableHead>
              <TableHead>{t('columns.user')}</TableHead>
              <TableHead>{t('columns.action')}</TableHead>
              <TableHead>{t('columns.entity')}</TableHead>
              <TableHead>{t('columns.details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} style={{ textAlign: 'center' }}>{t('common:status.loading')}</TableCell></TableRow>
            ) : logs?.map((log: any, index: number) => (
              <TableRow key={index}>
                <TableCell>{new Date(log.createdAt).toLocaleString('uz-UZ')}</TableCell>
                <TableCell>{log.userFullName}</TableCell>
                <TableCell>
                  <span style={{ padding: '4px 8px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', fontSize: '12px' }}>
                    {log.action}
                  </span>
                </TableCell>
                <TableCell>{log.entityType} ({log.entityId.slice(0, 8)})</TableCell>
                <TableCell style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                  {JSON.stringify(log.details)}
                </TableCell>
              </TableRow>
            ))}
            {(!logs || logs.length === 0) && !isLoading && (
              <TableRow><TableCell colSpan={5} style={{ textAlign: 'center' }}>{t('common:status.empty')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
