import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import toast from 'react-hot-toast';
import styles from './ExpensesPage.module.css';

export const ExpenseDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: expense, isLoading, isError } = useQuery({
    queryKey: ['expense', id],
    queryFn: async () => {
      const response = await apiClient.get(`/expenses/${id}`);
      return response.data;
    }
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, comment }: { status: string, comment?: string }) => {
      await apiClient.patch(`/expenses/${id}/status`, { status, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success("Status o'zgartirildi");
    }
  });

  if (isLoading) return <div className={styles.container}>Yuklanmoqda...</div>;
  if (isError || !expense) return <div className={styles.container}>Xatolik yuz berdi yoki topilmadi.</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{expense.globalNumber} <span style={{ fontSize: '1rem', color: 'rgb(var(--muted-foreground))' }}>{expense.branchNumber}</span></h1>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <StatusBadge status={expense.status} />
            <span style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
              {new Intl.NumberFormat('uz-UZ').format(expense.amount)} {expense.currency}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" onClick={() => navigate('/expenses')}>Orqaga</Button>
          {expense.status === 'PENDING' && (
            <>
              <Button onClick={() => statusMutation.mutate({ status: 'APPROVED' })}>Tasdiqlash</Button>
              <Button variant="destructive" onClick={() => {
                const comment = prompt("Rad etish sababi:");
                if (comment) statusMutation.mutate({ status: 'REJECTED', comment });
              }}>Rad etish</Button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
        <Card>
          <CardHeader>
            <CardTitle>Asosiy ma'lumotlar</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div><strong>Filial:</strong> {expense.branch?.name}</div>
              <div><strong>Kategoriya:</strong> {expense.category?.name}</div>
              <div><strong>Sana:</strong> {expense.date}</div>
              <div><strong>To'lov usuli:</strong> {expense.paymentMethod}</div>
              <div style={{ gridColumn: '1 / -1' }}><strong>Izoh:</strong> {expense.reason || '-'}</div>
            </div>
          </CardContent>
        </Card>

        {expense.shares && expense.shares.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Taqsimlash jadvali</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Xodim</TableHead>
                    <TableHead style={{ textAlign: 'right' }}>Summa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expense.shares.map((share: any) => (
                    <TableRow key={share.id}>
                      <TableCell>{share.employee?.fullName}</TableCell>
                      <TableCell style={{ textAlign: 'right' }}>
                        {new Intl.NumberFormat('uz-UZ').format(share.amount)} {expense.currency}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {expense.attachments && expense.attachments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Chek / Isbot fayllar</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {expense.attachments.map((file: any) => (
                  <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ padding: '0.5rem', border: '1px solid rgb(var(--border))', borderRadius: '4px' }}>
                    {file.name || 'Faylni ko\'rish'}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
