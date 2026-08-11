import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { LoginForm } from './components/LoginForm';

export const LoginPage = () => {
  return (
    <Card style={{ width: '400px', maxWidth: '100%' }}>
      <CardHeader style={{ textAlign: 'center' }}>
        <CardTitle style={{ fontSize: '24px' }}>Web ERP</CardTitle>
        <CardDescription>Tizimga kirish uchun login va parolni kiriting</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
};
