import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { PieChart, Plus, Building, FolderTree, Users } from 'lucide-react';
import { MockService } from '@/mocks/mockService';
import { Budget } from '@/mocks/data';

export const BudgetsPage = () => {
  const [activeScope, setActiveScope] = useState<'ALL' | 'BRANCH' | 'CATEGORY' | 'EMPLOYEE'>('BRANCH');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>(MockService.getBudgets());

  // Form State
  const [scopeType, setScopeType] = useState<'BRANCH' | 'CATEGORY' | 'EMPLOYEE'>('BRANCH');
  const [scopeId, setScopeId] = useState('');
  const [scopeName, setScopeName] = useState('');
  const [period, setPeriod] = useState('2026-08');
  const [amountLimit, setAmountLimit] = useState('25000000');

  const branches = MockService.getBranches('active');
  const categories = MockService.getCategories();
  const employees = MockService.getEmployees();

  const filteredBudgets = activeScope === 'ALL'
    ? budgets
    : budgets.filter(b => b.scopeType === activeScope);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    let name = scopeName;
    if (scopeType === 'BRANCH') {
      name = branches.find(b => b.id === scopeId)?.name || 'Filial';
    } else if (scopeType === 'CATEGORY') {
      name = categories.find(c => c.id === scopeId)?.nameUz || 'Kategoriya';
    } else {
      name = employees.find(e => e.id === scopeId)?.fullName || 'Xodim';
    }

    MockService.createBudget({
      scopeType,
      scopeId,
      scopeName: name,
      period,
      amountLimit: parseFloat(amountLimit) || 10000000,
      actualAmount: 0
    });

    setBudgets(MockService.getBudgets());
    setIsCreateOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>Byudjet limitlari va nazorat</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Filiallar, xarajat toifalari va xodimlar kesimida oylik limitlar
          </span>
        </div>

        <Button style={{ gap: '6px' }} onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Yangi byudjet limiti
        </Button>
      </div>

      {/* Scope Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgb(var(--border))' }}>
        {[
          { id: 'BRANCH', label: 'Filiallar bo\'yicha', icon: Building },
          { id: 'CATEGORY', label: 'Kategoriyalar bo\'yicha', icon: FolderTree },
          { id: 'EMPLOYEE', label: 'Xodimlar bo\'yicha', icon: Users },
          { id: 'ALL', label: 'Barchasi', icon: PieChart },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveScope(tab.id as any)}
              style={{
                padding: '10px 18px',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeScope === tab.id ? 'rgb(var(--primary))' : 'transparent'}`,
                color: activeScope === tab.id ? 'rgb(var(--primary))' : 'rgb(var(--muted-foreground))',
                fontWeight: 600,
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obyekt (Scope)</TableHead>
              <TableHead>Davr</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Belgilangan limit</TableHead>
              <TableHead style={{ textAlign: 'right' }}>Haqiqiy sarf (Fakt)</TableHead>
              <TableHead style={{ width: '220px' }}>Ijro ko'rsatkichi (%)</TableHead>
              <TableHead style={{ textAlign: 'center' }}>Holati</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBudgets.map((b) => {
              const percent = Math.round((b.actualAmount / b.amountLimit) * 100);
              const color = percent >= 100 ? 'rgb(var(--destructive))' : percent >= 80 ? '#f59e0b' : 'rgb(var(--success))';
              const statusText = percent >= 100 ? 'Limit oshgan ⚠️' : percent >= 80 ? 'Diqqat (≥80%)' : 'Normada';

              return (
                <TableRow key={b.id}>
                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{b.scopeName}</div>
                    <div style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>
                      Turi: {b.scopeType} • ID: {b.scopeId}
                    </div>
                  </TableCell>
                  <TableCell style={{ fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{b.period}</TableCell>
                  <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                    {new Intl.NumberFormat('uz-UZ').format(b.amountLimit)} UZS
                  </TableCell>
                  <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono', color }}>
                    {new Intl.NumberFormat('uz-UZ').format(b.actualAmount)} UZS
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, color }}>
                        <span>{percent}%</span>
                        <span>{new Intl.NumberFormat('uz-UZ').format(b.amountLimit - b.actualAmount)} UZS qoldi</span>
                      </div>
                      <div style={{ width: '100%', height: '7px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, percent)}%`,
                          height: '100%',
                          backgroundColor: color,
                          borderRadius: '4px'
                        }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: '11.5px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: percent >= 100 ? 'rgba(239, 68, 68, 0.15)' : percent >= 80 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color,
                      fontWeight: 700
                    }}>
                      {statusText}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Budget Modal */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Yangi byudjet limiti belgilash"
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Select
            label="Limit obyekti turi (Scope)"
            value={scopeType}
            onChange={(e) => {
              setScopeType(e.target.value as any);
              setScopeId('');
            }}
            required
          >
            <option value="BRANCH">Filial bo'yicha</option>
            <option value="CATEGORY">Kategoriya bo'yicha</option>
            <option value="EMPLOYEE">Alohida xodim bo'yicha</option>
          </Select>

          <Select
            label="Obyektni tanlang"
            value={scopeId}
            onChange={(e) => setScopeId(e.target.value)}
            required
          >
            <option value="">Tanlang...</option>
            {scopeType === 'BRANCH' && branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
            {scopeType === 'CATEGORY' && categories.map(c => (
              <option key={c.id} value={c.id}>{c.nameUz}</option>
            ))}
            {scopeType === 'EMPLOYEE' && employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.branchName})</option>
            ))}
          </Select>

          <Input
            label="Davr (YYYY-MM)"
            placeholder="2026-08"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            required
          />

          <Input
            label="Oylik limit summasi (UZS)"
            type="number"
            placeholder="25000000"
            value={amountLimit}
            onChange={(e) => setAmountLimit(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit">
              Limitni saqlash
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
