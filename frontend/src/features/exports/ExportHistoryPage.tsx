import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { useExports } from './api';
import { Download, Loader2 } from 'lucide-react';
import styles from './ExportHistoryPage.module.css';

export const ExportHistoryPage = () => {
  const { t } = useTranslation(['reports', 'common']);
  const { data, isLoading } = useExports();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Eksportlar tarixi</h1>
      </div>

      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tur</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Yaratilgan vaqt</TableHead>
              <TableHead>Holat</TableHead>
              <TableHead>Qatorlar</TableHead>
              <TableHead>Muddati</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Amallar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} style={{ textAlign: 'center' }}>{t('common:status.loading')}</TableCell></TableRow>
            ) : data?.map((row: any) => (
              <TableRow key={row.id}>
                <TableCell>{row.type}</TableCell>
                <TableCell>{row.format}</TableCell>
                <TableCell>{new Date(row.createdAt).toLocaleString('uz-UZ')}</TableCell>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {(row.status === 'QUEUED' || row.status === 'RUNNING') && <Loader2 size={14} className={styles.spin} />}
                    <span className={styles[`status_${row.status}`] || ''}>{row.status}</span>
                  </div>
                </TableCell>
                <TableCell>{row.rowCount ?? '-'}</TableCell>
                <TableCell>{row.expiresAt ? new Date(row.expiresAt).toLocaleString('uz-UZ') : '-'}</TableCell>
                <TableCell style={{ textAlign: 'right' }}>
                  <Button variant="ghost" size="sm" disabled={row.status !== 'DONE'}>
                    <Download size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
