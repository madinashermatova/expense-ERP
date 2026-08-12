import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useBranches, useCategories, useEmployees } from '@/features/expenses/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import styles from './SettingsPage.module.css';

export const SettingsPage = () => {
  const { user } = useAuthStore();
  if (user?.role !== 'ADMIN' && user?.role !== 'PLATFORM_OWNER') {
    return <Navigate to="/" />;
  }

  const [activeTab, setActiveTab] = useState<'employees' | 'categories' | 'branches'>('employees');
  
  const { data: branches, isLoading: loadingBranches } = useBranches();
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: employees, isLoading: loadingEmployees } = useEmployees();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Sozlamalar</h1>
        <Button style={{ gap: '8px' }}>
          <Plus size={16} /> Yangi qo'shish
        </Button>
      </div>

      <div className={styles.tabs}>
        <button 
          className={`${styles.tab} ${activeTab === 'employees' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Xodimlar
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'categories' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Kategoriyalar
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'branches' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('branches')}
        >
          Filiallar
        </button>
      </div>

      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
        {activeTab === 'employees' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>F.I.O</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEmployees ? (
                <TableRow><TableCell colSpan={3}>Yuklanmoqda...</TableCell></TableRow>
              ) : employees?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.fullName}</TableCell>
                  <TableCell>{branches?.find((b: any) => b.id === e.branchId)?.name || e.branchId}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm">Tahrirlash</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'categories' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nomi</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Chek talabi</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCategories ? (
                <TableRow><TableCell colSpan={4}>Yuklanmoqda...</TableCell></TableRow>
              ) : categories?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.maxAmountPerEntry ? `${new Intl.NumberFormat('uz-UZ').format(Number(c.maxAmountPerEntry))} so'm` : 'Cheklanmagan'}</TableCell>
                  <TableCell>{c.receiptRequired ? 'Ha' : "Yo'q"}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm">Tahrirlash</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'branches' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kodi</TableHead>
                <TableHead>Nomi</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Amallar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingBranches ? (
                <TableRow><TableCell colSpan={3}>Yuklanmoqda...</TableCell></TableRow>
              ) : branches?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{b.code}</TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}>
                    <Button variant="ghost" size="sm">Tahrirlash</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};
