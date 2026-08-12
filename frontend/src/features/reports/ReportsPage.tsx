import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Download } from 'lucide-react';
import { useReports } from './api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './ReportsPage.module.css';

export const ReportsPage = () => {
  const { t } = useTranslation(['reports', 'common']);
  const [type, setType] = useState('byBranch');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useReports({ type, startDate, endDate });

  const handleExport = () => {
    alert("Exporting to Excel...");
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Button onClick={handleExport} style={{ gap: '8px' }}>
          <Download size={16} /> {t('export')}
        </Button>
      </div>

      <div className={styles.filters}>
        <Select label="Hisobot turi" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="byBranch">{t('types.byBranch')}</option>
          <option value="byCategory">{t('types.byCategory')}</option>
          <option value="byEmployee">{t('types.byEmployee')}</option>
          <option value="budgetVsActual">{t('types.budgetVsActual')}</option>
        </Select>
        <Input label="Dan" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="Gacha" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>{t('common:status.loading')}</div>
      ) : (
        <>
          <div style={{ height: '300px', backgroundColor: 'rgb(var(--card))', padding: '16px', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data || []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis dataKey="group" stroke="rgb(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="rgb(var(--muted-foreground))" fontSize={12} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="totalAmount" fill="rgb(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('columns.group')}</TableHead>
                  <TableHead>{t('columns.count')}</TableHead>
                  <TableHead style={{ textAlign: 'right' }}>{t('columns.totalAmount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{row.group}</TableCell>
                    <TableCell>{row.count}</TableCell>
                    <TableCell style={{ textAlign: 'right' }}>
                      {new Intl.NumberFormat('uz-UZ').format(Number(row.totalAmount))} so'm
                    </TableCell>
                  </TableRow>
                ))}
                {(!data || data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} style={{ textAlign: 'center' }}>{t('common:status.empty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};
