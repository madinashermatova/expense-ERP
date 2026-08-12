import { useBudgets } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

export const BudgetsPage = () => {
  const { data: budgets, isLoading } = useBudgets();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Byudjetlar</h1>
        <Button>+ Yangi byudjet</Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kapsam</TableHead>
            <TableHead>Davr</TableHead>
            <TableHead>Limit</TableHead>
            <TableHead>Sarflandi</TableHead>
            <TableHead>Amallar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5}>Yuklanmoqda...</TableCell></TableRow>
          ) : budgets?.map((b: any) => (
            <TableRow key={b.id}>
              <TableCell>{b.scopeType} ({b.scopeId})</TableCell>
              <TableCell>{b.period}</TableCell>
              <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(b.amountLimit))}</TableCell>
              <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(b.actualAmount || 0))}</TableCell>
              <TableCell><Button variant="ghost" size="sm">Tahrirlash</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
