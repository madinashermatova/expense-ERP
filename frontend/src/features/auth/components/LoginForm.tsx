import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin, loginSchema, LoginFormData } from '../api';
import styles from './LoginForm.module.css';

export const LoginForm = () => {
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
  });
  const loginMutation = useLogin();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [companiesToSelect, setCompaniesToSelect] = useState<{ slug: string, name: string }[] | null>(null);

  const onSubmit = (data: LoginFormData) => {
    setGlobalError(null);
    loginMutation.mutate(data, {
      onError: (error: any) => {
        const errData = error?.response?.data;
        const status = error?.response?.status;
        const code = errData?.code;

        if (status === 429) {
          if (code === 'LOGIN_LOCKED') {
            setGlobalError("Ko'p noto'g'ri urinishlar. Hisob bloklandi, kuting.");
          } else {
            setGlobalError("Kop urinishlar. Iltimos 15 daqiqadan so'ng qayta urinib ko'ring.");
          }
        } else if (status === 409 && code === 'MULTIPLE_COMPANIES') {
          // Parse companies ["alfa:Alfa Savdo MChJ", ...]
          const rawCompanies: string[] = errData?.details?.companies || [];
          const parsed = rawCompanies.map(c => {
            const [slug, ...nameParts] = c.split(':');
            return { slug, name: nameParts.join(':') };
          });
          setCompaniesToSelect(parsed);
        } else if (status === 403) {
          if (code === 'WEB_ACCESS_DENIED') {
            setGlobalError("Bu tizim faqat Telegram bot orqali ishlaydi");
          } else if (code === 'ACCOUNT_INACTIVE') {
            setGlobalError("Hisob faol emas — administratoringizga murojaat qiling");
          } else if (code === 'COMPANY_SUSPENDED') {
            setGlobalError("Kompaniya hisobi to'xtatilgan");
          } else {
            setGlobalError("Ruxsat etilmagan (403)");
          }
        } else if (status === 401 && code === 'INVALID_CREDENTIALS') {
          setGlobalError("Login yoki parol noto'g'ri");
        } else {
          setGlobalError("Login yoki parol noto'g'ri");
        }
      }
    });
  };

  if (companiesToSelect) {
    return (
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <p style={{ fontSize: '14px', marginBottom: '8px' }}>Siz bir nechta kompaniyaga biriktirilgansiz. Iltimos, birini tanlang:</p>
        <select 
          {...register('companySlug')} 
          required
          style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgb(var(--border))' }}
        >
          <option value="">Kompaniyani tanlang...</option>
          {companiesToSelect.map(c => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        {/* Hidden inputs to resubmit original login/password */}
        <input type="hidden" {...register('login')} />
        <input type="hidden" {...register('password')} />
        
        <Button type="submit" disabled={loginMutation.isPending} style={{ marginTop: '8px' }}>
          {loginMutation.isPending ? 'Kirish...' : 'Davom etish'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setCompaniesToSelect(null)}>
          Orqaga
        </Button>
      </form>
    );
  }

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
