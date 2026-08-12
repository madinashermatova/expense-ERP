<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
=======
import React from 'react';
import { useState } from 'react';
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
import { useAuthStore } from '@/features/auth/store';
import { usePendingExpenses, useApproveExpense, useRejectExpense, useBulkApproveExpenses } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
<<<<<<< HEAD
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ExpenseDetailModal } from '@/components/shared/ExpenseDetailModal';
import {
  CheckCircle2,
  XCircle,
  Eye,
  LayoutGrid,
  List,
  FileText,
  AlertTriangle,
  Keyboard,
  Building,
  Calendar,
  Users
} from 'lucide-react';
=======
import { Check, X, Eye, AlertCircle } from 'lucide-react';
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
import styles from './ApprovalsPage.module.css';
import { Dialog } from '@/components/ui/Dialog';

export const ApprovalsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  const [activeTab, setActiveTab] = useState<'1' | '2'>('1');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  const { data, isLoading } = usePendingExpenses(activeTab);
  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();
  const bulkApproveMutation = useBulkApproveExpenses();

<<<<<<< HEAD
  const items = data?.items || [];

  // Keyboard shortcut support (A: Approve, R: Reject)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (items.length === 0) return;

      const firstItem = items[0];
      if (e.key.toLowerCase() === 'a' && firstItem) {
        // Approve first item
        approveMutation.mutate(firstItem.id);
      } else if (e.key.toLowerCase() === 'r' && firstItem) {
        // Open modal for reject
        setSelectedExpense(firstItem);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, approveMutation]);

  const handleApprove = (id: string) => {
=======
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkErrors, setBulkErrors] = useState<any[]>([]);

  // Reset selection when tab changes
  React.useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const handleApprove = React.useCallback((id: string) => {
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    approveMutation.mutate(id, {
      onSuccess: () => setSelectedExpense(null)
    });
  }, [approveMutation]);

<<<<<<< HEAD
  const handleReject = (id: string, reason: string) => {
    rejectMutation.mutate({ id, reason }, {
      onSuccess: () => setSelectedExpense(null)
=======
  const handleReject = React.useCallback((id: string) => {
    const reason = window.prompt("Rad etish sababini kiriting (kamida 10 belgi):");
    if (reason && reason.length >= 10) {
      rejectMutation.mutate({ id, reason }, {
        onSuccess: () => setSelectedExpense(null)
      });
    } else if (reason) {
      alert("Sabab kamida 10 belgi bo'lishi kerak!");
    }
  }, [rejectMutation]);

  const handleBulkApprove = () => {
    if (selectedIds.length === 0) return;
    setBulkErrors([]);
    bulkApproveMutation.mutate(selectedIds, {
      onSuccess: (data: any) => {
        // qisman xatolar bo'lsa
        if (data?.errors && data.errors.length > 0) {
          setBulkErrors(data.errors);
        } else {
          setSelectedIds([]);
        }
        setSelectedExpense(null);
      },
      onError: (err: any) => {
        if (err?.response?.data?.details) {
          setBulkErrors(err.response.data.details);
        }
      }
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    });
  };

  // Keyboard navigation for A (Approve) and R (Reject)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Faqatgina modal ochiq va input maydonida bo'lmaganda ishlaydi
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!selectedExpense) return;

      if (e.key.toLowerCase() === 'a') {
        handleApprove(selectedExpense.id);
      } else if (e.key.toLowerCase() === 'r') {
        handleReject(selectedExpense.id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedExpense, handleApprove, handleReject]);

  const toggleSelectAll = () => {
    if (data?.items) {
      if (selectedIds.length === data.items.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(data.items.map((item: any) => item.id));
      }
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedTotal = data?.items
    ?.filter((item: any) => selectedIds.includes(item.id))
    .reduce((sum: number, item: any) => sum + Number(item.amount), 0) || 0;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
<<<<<<< HEAD
        <div>
          <h2 className={styles.title}>Tasdiqlash navbati</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Ko'rib chiqish va yakuniy tasdiqlash uchun yuborilgan arizalar
          </span>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('cards')}
            >
              <LayoutGrid size={15} /> Kartalar
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('table')}
            >
              <List size={15} /> Jadval
            </button>
          </div>
        </div>
=======
        <h1 className={styles.title}>Tasdiqlash navbati</h1>
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontWeight: 'bold' }}>
              Tanlanganlar: {selectedIds.length} ta ( {new Intl.NumberFormat('uz-UZ').format(selectedTotal)} UZS )
            </div>
            <Button onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending}>
              {bulkApproveMutation.isPending ? 'Tasdiqlanmoqda...' : 'Tanlanganlarni tasdiqlash'}
            </Button>
          </div>
        )}
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === '1' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('1')}
        >
          <span>1-bosqich (Direktor tasdig'i)</span>
          <span className={styles.tabBadge}>4</span>
        </button>

        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === '2' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('2')}
          >
            <span>2-bosqich (Admin yakuniy tasdig'i)</span>
            <span className={styles.tabBadge} style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0284c7' }}>
              2
            </span>
          </button>
        )}
      </div>

      {/* Keyboard Shortcuts Hint Banner */}
      <div className={styles.shortcutHint}>
        <Keyboard size={16} />
        <span>
          Tezkor klaviatura: <span className={styles.kbd}>A</span> Tasdiqlash • <span className={styles.kbd}>R</span> Rad etish • Kartani bosib to'liq ma'lumotlarni ko'ring
        </span>
      </div>

      {/* Main Content */}
      {isLoading ? (
<<<<<<< HEAD
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
          Yuklanmoqda...
        </div>
      ) : items.length === 0 ? (
        <div style={{
          padding: '48px 24px',
          textAlign: 'center',
          backgroundColor: 'rgb(var(--card))',
          borderRadius: 'var(--radius)',
          border: '1px solid rgb(var(--card-border))'
        }}>
          <CheckCircle2 size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>
            Hozircha tasdiqlash uchun arizalar yo'q
          </h3>
          <p style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Barcha kiritilgan xarajatlar ko'rib chiqilgan.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View (with Receipt thumbnail) */
        <div className={styles.cardsGrid}>
          {items.map((item: any) => {
            const isOwn = item.createdById === user?.id || (user?.fullName && item.createdByName?.includes(user.fullName));
            return (
              <div key={item.id} className={styles.approvalCard} onClick={() => setSelectedExpense(item)}>
                <div className={styles.cardTop}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: '15px', color: 'rgb(var(--primary))' }}>
                      {item.globalNumber}
                    </span>
                    <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontFamily: 'JetBrains Mono' }}>
                      {item.branchNumber}
                    </span>
=======
        <div>Yuklanmoqda...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={data?.items?.length > 0 && selectedIds.length === data?.items?.length}
                  onChange={toggleSelectAll}
                />
              </TableHead>
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
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <div style={{ fontFamily: 'monospace' }}>{item.globalNumber}</div>
                </TableCell>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.category.name}</TableCell>
                <TableCell>{item.employees?.[0]?.fullName} {item.employees?.length > 1 ? `(+${item.employees.length - 1})` : ''}</TableCell>
                <TableCell>
                  <div className={styles.amount}>
                    {new Intl.NumberFormat('uz-UZ').format(Number(item.amount))} {item.currency}
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
                  </div>
                  <StatusBadge status={item.status} />
                </div>

                {/* Receipt Preview if available */}
                {item.files && item.files.length > 0 ? (
                  <div className={styles.receiptThumb}>
                    <img src={item.files[0].url} alt="Chek" />
                  </div>
                ) : (
                  <div className={styles.receiptThumb} style={{ border: '1px dashed rgb(var(--border))' }}>
                    <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <FileText size={16} /> Chek yuklanmagan
                    </span>
                  </div>
                )}

                {/* Details */}
                <div className={styles.cardDetails}>
                  <div className={styles.cardDetailItem}>
                    <span className={styles.detailLabel}>Filial</span>
                    <span className={styles.detailValue}>{item.branchName || item.branch?.name}</span>
                  </div>
                  <div className={styles.cardDetailItem}>
                    <span className={styles.detailLabel}>Kategoriya</span>
                    <span className={styles.detailValue}>{item.categoryName || item.category?.name}</span>
                  </div>
                  <div className={styles.cardDetailItem}>
                    <span className={styles.detailLabel}>Xodim</span>
                    <span className={styles.detailValue}>{item.createdByName || item.employees?.[0]?.fullName}</span>
                  </div>
                  <div className={styles.cardDetailItem}>
                    <span className={styles.detailLabel}>Sana</span>
                    <span className={styles.detailValue}>{item.date}</span>
                  </div>
                </div>

                {/* Four-Eyes alert badge if own expense */}
                {isOwn && (
                  <div style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'rgb(var(--warning-subtle))',
                    color: 'rgb(var(--warning-foreground))',
                    fontSize: '11px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <AlertTriangle size={14} /> O'zingiz kiritgan xarajat (Four-eyes)
                  </div>
                )}

                {/* Card Footer */}
                <div className={styles.cardFooter}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10.5px', color: 'rgb(var(--muted-foreground))', fontWeight: 600, textTransform: 'uppercase' }}>Summa</span>
                    <span style={{ fontSize: '17px', fontWeight: 800, fontFamily: 'JetBrains Mono', color: 'rgb(var(--foreground))' }}>
                      {new Intl.NumberFormat('uz-UZ').format(Number(item.amount))} <span style={{ fontSize: '12px' }}>{item.currency}</span>
                    </span>
                  </div>

                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedExpense(item)}
                      title="Batafsil ko'rish"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button
                      size="sm"
                      style={{ backgroundColor: 'rgb(var(--destructive))', color: 'white', padding: '6px 10px' }}
                      onClick={() => setSelectedExpense(item)}
                      disabled={isOwn}
                      title="Rad etish"
                    >
                      <XCircle size={15} />
                    </Button>
                    <Button
                      size="sm"
                      style={{ backgroundColor: 'rgb(var(--success))', color: 'white', padding: '6px 12px' }}
                      onClick={() => handleApprove(item.id)}
                      disabled={isOwn || approveMutation.isPending}
                      title="Tasdiqlash"
                    >
                      <CheckCircle2 size={15} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div style={{ backgroundColor: 'rgb(var(--card))', borderRadius: 'var(--radius)', border: '1px solid rgb(var(--card-border))', overflow: 'hidden' }}>
          <Table>
            <TableHeader>
              <TableRow>
<<<<<<< HEAD
                <TableHead>Raqam</TableHead>
                <TableHead>Sana</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Kategoriya</TableHead>
                <TableHead>Xodim</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Summa</TableHead>
                <TableHead style={{ textAlign: 'center' }}>Amallar</TableHead>
=======
                <TableCell colSpan={7} style={{ textAlign: 'center', padding: '24px' }}>
                  Tasdiqlash uchun xarajatlar yo'q
                </TableCell>
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any) => (
                <TableRow
                  key={item.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedExpense(item)}
                >
                  <TableCell>
                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                      {item.globalNumber}
                    </span>
                  </TableCell>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{item.branchName || item.branch?.name}</TableCell>
                  <TableCell>{item.categoryName || item.category?.name}</TableCell>
                  <TableCell>{item.createdByName || item.employees?.[0]?.fullName}</TableCell>
                  <TableCell style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono' }}>
                    {new Intl.NumberFormat('uz-UZ').format(Number(item.amount))} {item.currency}
                  </TableCell>
                  <TableCell style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedExpense(item)}>
                        <Eye size={16} />
                      </Button>
                      <Button
                        size="sm"
                        style={{ backgroundColor: 'rgb(var(--success))', color: 'white' }}
                        onClick={() => handleApprove(item.id)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        isPending={approveMutation.isPending || rejectMutation.isPending}
      />

      <Dialog open={bulkErrors.length > 0} onClose={() => setBulkErrors([])} title="Ommaviy tasdiqlash xatolari">
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ color: 'rgb(var(--destructive))', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={20} />
            <span>Ba'zi xarajatlarni tasdiqlashda xatolik yuz berdi:</span>
          </div>
          <ul style={{ paddingLeft: '1.5rem', listStyle: 'disc' }}>
            {bulkErrors.map((err, i) => (
              <li key={i} style={{ marginBottom: '0.5rem' }}>
                <b>{err.globalNumber || err.id || 'Noma\'lum xarajat'}:</b> {err.message || 'Xatolik yuz berdi'}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={() => setBulkErrors([])}>Yopish</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
