import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  useExpenses,
  useBranches,
  useCategories,
  useApproveExpense,
  useRejectExpense,
  useRequestFixExpense,
  useBulkApproveExpenses,
  useCreateExport
} from './api';
import { useAuthStore } from '@/features/auth/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ExpenseDetailModal } from '@/components/shared/ExpenseDetailModal';
import { Dialog } from '@/components/ui/Dialog';
import {
  Plus,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCheck,
  Search,
  RotateCcw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from './ExpensesPage.module.css';

const columnHelper = createColumnHelper<any>();

export const ExpensesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  // Filters State
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState(isAdmin ? '' : (user?.branchId || ''));
  const [categoryFilter, setCategoryFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  // Selection & Modals
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('xlsx');
  const [exportToast, setExportToast] = useState(false);

  // Queries & Mutations
  const { data: branches } = useBranches();
  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useExpenses({
    page,
    limit: 10,
    q: searchQuery,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    branchId: branchFilter || undefined,
    categoryId: categoryFilter || undefined,
    paymentMethod: paymentMethodFilter || undefined
  });

  const approveMutation = useApproveExpense();
  const rejectMutation = useRejectExpense();
  const fixMutation = useRequestFixExpense();
  const bulkApproveMutation = useBulkApproveExpenses();
  const exportMutation = useCreateExport();

  // Column definitions
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          style={{ cursor: 'pointer' }}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'pointer' }}
        />
      ),
    }),
    columnHelper.accessor('globalNumber', {
      header: '№ Raqam',
      cell: info => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'rgb(var(--primary))' }}>
            {info.getValue()}
          </span>
          <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))', fontFamily: 'JetBrains Mono' }}>
            {info.row.original.branchNumber}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('date', {
      header: 'Sana',
      cell: info => <span style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{info.getValue()}</span>,
    }),
    columnHelper.accessor('branchName', {
      header: 'Filial',
      cell: info => (
        <span style={{ fontWeight: 500, fontSize: '13px' }}>
          {info.getValue() || info.row.original.branch?.name}
        </span>
      ),
    }),
    columnHelper.accessor('categoryName', {
      header: 'Kategoriya',
      cell: info => (
        <span style={{ fontSize: '13px', color: 'rgb(var(--foreground))' }}>
          {info.getValue() || info.row.original.category?.name}
        </span>
      ),
    }),
    columnHelper.accessor('createdByName', {
      header: 'Xodim(lar)',
      cell: info => {
        const empName = info.getValue() || info.row.original.employees?.[0]?.fullName || 'Xodim';
        const sharesCount = info.row.original.shares?.length || 1;
        return (
          <div style={{ fontSize: '13px' }}>
            {empName}
            {sharesCount > 1 && (
              <span style={{
                marginLeft: '6px',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: 'rgb(var(--primary-subtle))',
                color: 'rgb(var(--primary))',
                fontWeight: 700
              }}>
                +{sharesCount - 1} kishi
              </span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor('amount', {
      header: () => <div style={{ textAlign: 'right' }}>Summa</div>,
      cell: info => {
        const amountFormatted = new Intl.NumberFormat('uz-UZ').format(Number(info.getValue()));
        return (
          <div className={styles.amount}>
            {amountFormatted} <span style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>{info.row.original.currency}</span>
          </div>
        );
      },
    }),
    columnHelper.accessor('status', {
      header: 'Holat',
      cell: info => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('hasReceipt', {
      header: 'Chek',
      cell: info => info.getValue() ? (
        <span title="Chek yuklangan" style={{ color: 'rgb(var(--primary))', display: 'flex', alignItems: 'center' }}>
          <FileText size={16} />
        </span>
      ) : (
        <span style={{ color: 'rgb(var(--muted-foreground))', fontSize: '12px' }}>—</span>
      ),
    }),
    columnHelper.accessor('isOverLimit', {
      header: '',
      cell: info => info.getValue() ? (
        <span title="Byudjet limitidan oshgan!" style={{ color: 'rgb(var(--warning))' }}>
          <AlertTriangle size={16} />
        </span>
      ) : null,
    })
  ], []);

  const table = useReactTable({
    data: data?.items || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
  });

  const selectedRows = table.getSelectedRowModel().rows;

  const handleBulkApprove = () => {
    const ids = selectedRows.map(r => r.original.id);
    if (ids.length === 0) return;
    if (window.confirm(`${ids.length} ta tanlangan xarajatni tasdiqlamoqchimisiz?`)) {
      bulkApproveMutation.mutate(ids, {
        onSuccess: () => {
          table.resetRowSelection();
          alert(`${ids.length} ta xarajat muvaffaqiyatli tasdiqlandi!`);
        }
      });
    }
  };

  const handleExport = () => {
    exportMutation.mutate({
      type: 'E1',
      format: exportFormat,
      filters: { status: statusFilter, branchId: branchFilter }
    }, {
      onSuccess: () => {
        setExportModalOpen(false);
        setExportToast(true);
        setTimeout(() => setExportToast(false), 4000);
      }
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setBranchFilter(isAdmin ? '' : (user?.branchId || ''));
    setCategoryFilter('');
    setPaymentMethodFilter('');
    setPage(1);
  };

  return (
    <div className={styles.container}>
      {/* Toast */}
      {exportToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          padding: '14px 20px',
          borderRadius: '10px',
          backgroundColor: '#059669',
          color: 'white',
          fontWeight: 600,
          boxShadow: 'var(--shadow-xl)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={20} />
          Eksport vazifasi navbatga qo'shildi! "Eksportlar tarixi" bo'limida yuklab olishingiz mumkin.
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Xarajatlar reestri</h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Barcha filiallar va xodimlar bo'yicha sarf-xarajatlar yozuvlari
          </span>
        </div>

        <div className={styles.actionsHeader}>
          <Button
            variant="secondary"
            style={{ gap: '6px' }}
            onClick={() => setExportModalOpen(true)}
          >
            <FileSpreadsheet size={16} /> Eksport (E1)
          </Button>

          <Button
            style={{ gap: '6px' }}
            onClick={() => navigate('/expenses/create')}
          >
            <Plus size={16} /> Yangi xarajat
          </Button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className={styles.filterCard}>
        <div className={styles.filterRow}>
          {/* Search */}
          <div className={styles.searchBox}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--muted-foreground))' }} />
              <input
                type="text"
                placeholder="Qidiruv (EXP-000101, izoh, xodim)..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgb(var(--border))',
                  backgroundColor: 'rgb(var(--background))',
                  color: 'rgb(var(--foreground))',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Branch Select */}
          {isAdmin && (
            <select
              className={styles.selectInput}
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setPage(1); }}
            >
              <option value="">Barcha filiallar</option>
              {branches?.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          {/* Category Select */}
          <select
            className={styles.selectInput}
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          >
            <option value="">Barcha kategoriyalar</option>
            {categories?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.nameUz || c.name}</option>
            ))}
          </select>

          {/* Payment Method */}
          <select
            className={styles.selectInput}
            value={paymentMethodFilter}
            onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}
          >
            <option value="">To'lov turi (Barchasi)</option>
            <option value="CARD">Plastik karta</option>
            <option value="CASH">Naqd pul</option>
            <option value="TRANSFER">Pul o'tkazmasi</option>
          </select>

          {/* Reset Filters */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            style={{ color: 'rgb(var(--muted-foreground))', gap: '4px' }}
            title="Filtrlarni tozalash"
          >
            <RotateCcw size={14} /> Tozalash
          </Button>
        </div>

        {/* Status Pill Filters */}
        <div className={styles.statusPills}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgb(var(--muted-foreground))', marginRight: '4px' }}>
            Holati:
          </span>
          {[
            { id: 'ALL', label: 'Barchasi' },
            { id: 'DIRECTOR_PENDING', label: '1-bosqich tasdiqda' },
            { id: 'ADMIN_PENDING', label: '2-bosqich tasdiqda' },
            { id: 'APPROVED', label: 'Tasdiqlangan' },
            { id: 'NEEDS_FIX', label: 'Tuzatishda' },
            { id: 'REJECTED', label: 'Rad etilgan' },
          ].map(pill => (
            <button
              key={pill.id}
              className={`${styles.statusPill} ${statusFilter === pill.id ? styles.statusPillActive : ''}`}
              onClick={() => { setStatusFilter(pill.id); setPage(1); }}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedRows.length > 0 && (
        <div className={styles.bulkBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCheck size={18} />
            <span>{selectedRows.length} ta xarajat tanlandi</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              size="sm"
              style={{ backgroundColor: 'rgb(var(--success))', color: 'white', gap: '6px' }}
              onClick={handleBulkApprove}
              disabled={bulkApproveMutation.isPending}
            >
              <CheckCircle2 size={16} /> Tanlanganlarni tasdiqlash (≤20)
            </Button>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className={styles.tableCard}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--muted-foreground))' }}>
            Ma'lumotlar yuklanmoqda...
          </div>
        ) : isError ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgb(var(--destructive))' }}>
            Xatolik yuz berdi. Qayta urinib ko'ring.
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map(row => (
                  <TableRow
                    key={row.id}
                    className={styles.tableRowClickable}
                    onClick={() => setSelectedExpense(row.original)}
                  >
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {(!data?.items || data.items.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={columns.length} style={{ textAlign: 'center', padding: '36px', color: 'rgb(var(--muted-foreground))' }}>
                      Filtr bo'yicha hech qanday xarajat topilmadi.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className={styles.pagination}>
              <span>
                Jami: <strong>{data?.total || 0}</strong> ta yozuvdan {((page - 1) * 10) + 1}–{Math.min(data?.total || 0, page * 10)} ko'rsatilmoqda
              </span>

              <div className={styles.pageControls}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ gap: '4px' }}
                >
                  <ChevronLeft size={16} /> Oldingi
                </Button>

                <span style={{ padding: '0 8px', fontWeight: 600 }}>
                  {page} / {data?.totalPages || 1}
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data?.totalPages || 1, p + 1))}
                  disabled={page >= (data?.totalPages || 1)}
                  style={{ gap: '4px' }}
                >
                  Keyingi <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Expense Detail Modal */}
      <ExpenseDetailModal
        expense={selectedExpense}
        open={!!selectedExpense}
        onClose={() => setSelectedExpense(null)}
        onApprove={(id) => {
          approveMutation.mutate(id, {
            onSuccess: () => setSelectedExpense(null)
          });
        }}
        onReject={(id, reason) => {
          rejectMutation.mutate({ id, reason }, {
            onSuccess: () => setSelectedExpense(null)
          });
        }}
        onRequestFix={(id, reason) => {
          fixMutation.mutate({ id, reason }, {
            onSuccess: () => setSelectedExpense(null)
          });
        }}
        isPending={approveMutation.isPending || rejectMutation.isPending || fixMutation.isPending}
      />

      {/* Export E1 Modal */}
      <Dialog
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Xarajatlar reestrini eksport qilish (E1)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13.5px', color: 'rgb(var(--foreground))' }}>
            Amaldagi filtrlangan <strong>{data?.total || 0} ta</strong> xarajat yozuvini hisobot shaklida yuklab olasiz:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'rgb(var(--muted-foreground))' }}>
              Fayl formati:
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="format"
                  value="xlsx"
                  checked={exportFormat === 'xlsx'}
                  onChange={() => setExportFormat('xlsx')}
                />
                Microsoft Excel (.xlsx)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={exportFormat === 'pdf'}
                  onChange={() => setExportFormat('pdf')}
                />
                Adobe PDF (.pdf)
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" onClick={() => setExportModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button onClick={handleExport} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? 'Eksport qilinmoqda...' : 'Yuklab olish'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
