import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin, loginSchema, LoginFormData } from '../api';
import styles from './LoginForm.module.css';

export const LoginForm = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });
  const loginMutation = useLogin();
  const [globalError, setGlobalError] = useState<string | null>(null);

  const onSubmit = (data: LoginFormData) => {
    setGlobalError(null);
    loginMutation.mutate(data, {
      onError: (error: any) => {
        if (error?.response?.status === 429) {
          setGlobalError("Kop urinishlar. Iltimos 15 daqiqadan so'ng qayta urinib ko'ring.");
        } else {
          setGlobalError("Login yoki parol noto'g'ri");
        }
      }
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      {globalError && (
        <div className={styles.errorAlert}>
          <AlertCircle size={16} />
          {globalError}
        </div>
      )}
      <Input
        label="Login"
        placeholder="Email yoki username"
        error={errors.login?.message}
        {...register('login')}
      />
      <Input
        label="Parol"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Button type="submit" disabled={loginMutation.isPending} style={{ marginTop: '8px' }}>
        {loginMutation.isPending ? 'Kirish...' : 'Tizimga kirish'}
      </Button>
    </form>
  );
};
