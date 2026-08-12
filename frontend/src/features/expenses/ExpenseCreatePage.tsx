import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ExpenseForm } from './components/ExpenseForm';
import { useNavigate } from 'react-router-dom';
import styles from './ExpensesPage.module.css'; // Reuse container styles

export const ExpenseCreatePage = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Yangi xarajat</h1>
      </div>
      <Card style={{ maxWidth: '800px' }}>
        <CardHeader>
          <CardTitle>Xarajat ma'lumotlari</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpenseForm 
            onCancel={() => navigate('/expenses')}
            onSuccess={() => navigate('/expenses')} 
          />
        </CardContent>
      </Card>
    </div>
  );
};
