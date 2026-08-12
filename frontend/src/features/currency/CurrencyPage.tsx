import { useCurrencies } from './api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';

export const CurrencyPage = () => {
  const { data: currencies, isLoading } = useCurrencies();

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Valyuta kurslari</h1>
        <Button>+ Yangi kurs</Button>
      </div>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sana</TableHead>
            <TableHead>Valyuta</TableHead>
            <TableHead>Kurs</TableHead>
            <TableHead>Amallar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4}>Yuklanmoqda...</TableCell></TableRow>
          ) : currencies?.map((c: any) => (
            <TableRow key={c.id}>
              <TableCell>{c.date}</TableCell>
              <TableCell>{c.currency}</TableCell>
              <TableCell>{new Intl.NumberFormat('uz-UZ').format(Number(c.rate))}</TableCell>
              <TableCell><Button variant="ghost" size="sm">Tahrirlash</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
