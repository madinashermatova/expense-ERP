import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useExpenses } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileText, Plus, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import styles from './ExpensesPage.module.css';

const columnHelper = createColumnHelper<any>();

const columns = [
  columnHelper.accessor('globalNumber', {
    header: 'Raqam',
    cell: info => (
      <div style={{ fontFamily: 'monospace' }}>
        <Link to={`/expenses/${info.row.original.id}`} style={{ color: 'rgb(var(--primary))', textDecoration: 'underline' }}>
          {info.getValue()}
        </Link>
        <br/>
        <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>{info.row.original.branchNumber}</span>
      </div>
    ),
  }),
  columnHelper.accessor('date', {
    header: 'Sana',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('branch.name', {
    header: 'Filial',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('category.name', {
    header: 'Kategoriya',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('amount', {
    header: () => <div style={{ textAlign: 'right' }}>Summa</div>,
    cell: info => {
      const amount = new Intl.NumberFormat('uz-UZ').format(Number(info.getValue()));
      return <div className={styles.amount}>{amount} {info.row.original.currency}</div>;
    },
  }),
  columnHelper.accessor('status', {
    header: 'Holat',
    cell: info => <StatusBadge status={info.getValue()} />,
  }),
  columnHelper.accessor('hasReceipt', {
    header: 'Chek',
    cell: info => info.getValue() ? <FileText size={16} color="rgb(var(--primary))" /> : <span style={{ color: 'rgb(var(--muted-foreground))' }}>Yo'q</span>,
  }),
  columnHelper.display({
    id: 'actions',
    cell: info => (
      <Link to={`/expenses/${info.row.original.id}`}>
        <Button variant="ghost" size="sm" style={{ padding: '4px' }}>
          <Eye size={16} />
        </Button>
      </Link>
    )
  })
];


export const ExpensesPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useExpenses({ page, limit: 10 });
  const navigate = useNavigate();

  const table = useReactTable({
    data: data?.items || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Xarajatlar</h1>
        <Button style={{ gap: '8px' }} onClick={() => navigate('/expenses/create')}>
          <Plus size={16} /> Yangi xarajat
        </Button>
      </div>

      <div className={styles.filters}>
        <Input placeholder="Qidiruv (raqam, izoh)..." style={{ width: '250px' }} />
        <Button variant="secondary">Filtrlar</Button>
      </div>

      {isLoading ? (
        <div>Yuklanmoqda...</div>
      ) : isError ? (
        <div>Xatolik yuz berdi.</div>
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
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className={styles.pagination}>
            <span>Jami: {data?.total || 0} ta yozuv</span>
            <div className={styles.pageControls}>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Oldingi</Button>
              <span>{page} / {data?.totalPages || 1}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(data?.totalPages || 1, p + 1))} disabled={page === (data?.totalPages || 1)}>Keyingi</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
