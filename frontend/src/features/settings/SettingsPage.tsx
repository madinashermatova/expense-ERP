import { useState } from 'react';

import { useBranches, useCategories, useEmployees } from '@/features/expenses/api';
import { useBudgets, useCurrencies } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Plus } from 'lucide-react';

import { useTranslation } from 'react-i18next';
import styles from './SettingsPage.module.css';
import { EmployeeForm } from './components/EmployeeForm';
import { BranchForm } from './components/BranchForm';
import { CategoryForm } from './components/CategoryForm';
import { BudgetForm } from './components/BudgetForm';
import { CurrencyForm } from './components/CurrencyForm';

export const SettingsPage = () => {



  const { t } = useTranslation(['settings', 'common']);
  const [activeTab, setActiveTab] = useState<'employees' | 'categories' | 'branches' | 'budgets' | 'currencies'>('employees');
  
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const { data: branches, isLoading: loadingBranches } = useBranches();
  const { data: categories, isLoading: loadingCategories } = useCategories();
  const { data: employees, isLoading: loadingEmployees } = useEmployees();
  const { data: budgets, isLoading: loadingBudgets } = useBudgets();
  const { data: currencies, isLoading: loadingCurrencies } = useCurrencies();

  const handleCreateClick = () => {
    if (activeTab === 'employees') setIsEmployeeOpen(true);
    if (activeTab === 'branches') setIsBranchOpen(true);
    if (activeTab === 'categories') setIsCategoryOpen(true);
    if (activeTab === 'budgets') setIsBudgetOpen(true);
    if (activeTab === 'currencies') setIsCurrencyOpen(true);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Button style={{ gap: '8px' }} onClick={handleCreateClick}>
          <Plus size={16} /> {t('common:actions.create')}
        </Button>
      </div>

      <div className={styles.tabs} style={{ display: 'flex', overflowX: 'auto' }}>
        <button className={`${styles.tab} ${activeTab === 'employees' ? styles.activeTab : ''}`} onClick={() => setActiveTab('employees')}>
          {t('tabs.employees')}
        </button>
        <button className={`${styles.tab} ${activeTab === 'categories' ? styles.activeTab : ''}`} onClick={() => setActiveTab('categories')}>
          {t('tabs.categories')}
        </button>
        <button className={`${styles.tab} ${activeTab === 'branches' ? styles.activeTab : ''}`} onClick={() => setActiveTab('branches')}>
          {t('tabs.branches')}
        </button>
        <button className={`${styles.tab} ${activeTab === 'budgets' ? styles.activeTab : ''}`} onClick={() => setActiveTab('budgets')}>
          Byudjetlar
        </button>
        <button className={`${styles.tab} ${activeTab === 'currencies' ? styles.activeTab : ''}`} onClick={() => setActiveTab('currencies')}>
          Valyutalar
        </button>
      </div>

      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--border))' }}>
        {activeTab === 'employees' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('employees.fullName')}</TableHead>
                <TableHead>{t('employees.branch')}</TableHead>
                <TableHead style={{ textAlign: 'right' }}>{t('common:actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEmployees ? (
                <TableRow><TableCell colSpan={3}>{t('common:status.loading')}</TableCell></TableRow>
              ) : employees?.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell>{e.fullName}</TableCell>
                  <TableCell>{branches?.find((b: any) => b.id === e.branchId)?.name || e.branchId}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}><Button variant="ghost" size="sm">{t('common:actions.edit')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'categories' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('categories.name')}</TableHead>
                <TableHead>{t('categories.limit')}</TableHead>
                <TableHead>{t('categories.receiptRequired')}</TableHead>
                <TableHead style={{ textAlign: 'right' }}>{t('common:actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCategories ? (
                <TableRow><TableCell colSpan={4}>{t('common:status.loading')}</TableCell></TableRow>
              ) : categories?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.maxAmountPerEntry ? `${new Intl.NumberFormat('uz-UZ').format(Number(c.maxAmountPerEntry))} so'm` : '-'}</TableCell>
                  <TableCell>{c.receiptRequired ? 'Ha' : "Yo'q"}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}><Button variant="ghost" size="sm">{t('common:actions.edit')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'branches' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('branches.code')}</TableHead>
                <TableHead>{t('branches.name')}</TableHead>
                <TableHead style={{ textAlign: 'right' }}>{t('common:actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingBranches ? (
                <TableRow><TableCell colSpan={3}>{t('common:status.loading')}</TableCell></TableRow>
              ) : branches?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{b.code}</TableCell>
                  <TableCell>{b.name}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}><Button variant="ghost" size="sm">{t('common:actions.edit')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'budgets' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('budgets.scope')}</TableHead>
                <TableHead>{t('budgets.period')}</TableHead>
                <TableHead>{t('budgets.limit')}</TableHead>
                <TableHead>{t('budgets.actual')}</TableHead>
                <TableHead>{t('budgets.progress')}</TableHead>
                <TableHead style={{ textAlign: 'right' }}>{t('common:actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingBudgets ? (
                <TableRow><TableCell colSpan={6}>{t('common:status.loading')}</TableCell></TableRow>
              ) : budgets?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>{b.scopeType} ({b.scopeId})</TableCell>
                  <TableCell>{b.period}</TableCell>
                  <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(b.amountLimit))}</TableCell>
                  <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(b.actualAmount))}</TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (b.actualAmount / b.amountLimit) * 100)}%`, backgroundColor: (b.actualAmount / b.amountLimit) > 1 ? 'red' : ((b.actualAmount / b.amountLimit) > 0.8 ? 'orange' : 'green') }}></div>
                      </div>
                      <span style={{ fontSize: '12px' }}>{Math.round((b.actualAmount / b.amountLimit) * 100)}%</span>
                    </div>
                  </TableCell>
                  <TableCell style={{ textAlign: 'right' }}><Button variant="ghost" size="sm">{t('common:actions.edit')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {activeTab === 'currencies' && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('currencies.date')}</TableHead>
                <TableHead>{t('currencies.currency')}</TableHead>
                <TableHead>{t('currencies.rate')}</TableHead>
                <TableHead style={{ textAlign: 'right' }}>{t('common:actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingCurrencies ? (
                <TableRow><TableCell colSpan={4}>{t('common:status.loading')}</TableCell></TableRow>
              ) : currencies?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell>{c.date}</TableCell>
                  <TableCell>{c.currency}</TableCell>
                  <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(c.rate))}</TableCell>
                  <TableCell style={{ textAlign: 'right' }}><Button variant="ghost" size="sm">{t('common:actions.edit')}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isEmployeeOpen} onClose={() => setIsEmployeeOpen(false)} title={t('employees.newEmployee')}>
        <EmployeeForm onSuccess={(pass) => { setIsEmployeeOpen(false); if (pass) setTempPassword(pass); }} onCancel={() => setIsEmployeeOpen(false)} />
      </Dialog>
      <Dialog open={isBranchOpen} onClose={() => setIsBranchOpen(false)} title={t('branches.newBranch')}>
        <BranchForm onSuccess={() => setIsBranchOpen(false)} onCancel={() => setIsBranchOpen(false)} />
      </Dialog>
      <Dialog open={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} title={t('categories.newCategory')}>
        <CategoryForm onSuccess={() => setIsCategoryOpen(false)} onCancel={() => setIsCategoryOpen(false)} />
      </Dialog>
      <Dialog open={isBudgetOpen} onClose={() => setIsBudgetOpen(false)} title={t('budgets.newBudget')}>
        <BudgetForm onSuccess={() => setIsBudgetOpen(false)} onCancel={() => setIsBudgetOpen(false)} />
      </Dialog>
      <Dialog open={isCurrencyOpen} onClose={() => setIsCurrencyOpen(false)} title={t('currencies.newCurrency')}>
        <CurrencyForm onSuccess={() => setIsCurrencyOpen(false)} onCancel={() => setIsCurrencyOpen(false)} />
      </Dialog>

      <Dialog open={!!tempPassword} onClose={() => setTempPassword(null)} title="Vaqtinchalik parol">
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <p>{t('employees.tempPasswordDesc')}</p>
          <div style={{ padding: '16px', backgroundColor: 'rgb(var(--muted))', borderRadius: 'var(--radius)', fontSize: '24px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '2px', margin: '16px 0' }}>
            {tempPassword}
          </div>
          <Button onClick={() => { navigator.clipboard.writeText(tempPassword || ''); setTempPassword(null); }}>
            Nusxalash va yopish
          </Button>
        </div>
      </Dialog>
    </div>
  );
};
