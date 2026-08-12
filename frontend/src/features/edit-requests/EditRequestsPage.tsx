import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import styles from './EditRequestsPage.module.css';

export const EditRequestsPage = () => {
  const { t } = useTranslation(['editRequests', 'common']);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
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
          <TableRow>
            <TableCell colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
              {t('common:status.empty')}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};
