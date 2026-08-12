import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { LoginForm } from './components/LoginForm';

export const LoginPage = () => {
  return (
    <Card style={{
      width: '460px',
      maxWidth: '100%',
      boxShadow: 'var(--shadow-xl)',
      borderRadius: '16px',
      border: '1px solid rgb(var(--card-border))',
      backgroundColor: 'rgb(var(--card))'
    }}>
      <CardHeader style={{ textAlign: 'center', paddingBottom: '16px' }}>
        <div style={{
          width: '54px',
          height: '54px',
          borderRadius: '14px',
          background: 'linear-gradient(135deg, rgb(var(--primary)) 0%, #4f46e5 100%)',
          color: 'white',
          fontWeight: 800,
          fontSize: '26px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 8px 16px rgba(43, 85, 215, 0.25)'
        }}>
          E
        </div>
        <CardTitle style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>
          Expense ERP
        </CardTitle>
        <CardDescription style={{ fontSize: '13.5px', marginTop: '4px' }}>
          Xarajatlar va moliyaviy oqimlarni boshqarish tizimi
        </CardDescription>
      </CardHeader>
      <CardContent style={{ padding: '0 28px 28px' }}>
        <LoginForm />
      </CardContent>
    </Card>
  );
};
