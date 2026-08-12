<<<<<<< HEAD
import React, { useState, useEffect } from 'react';
=======
import { useState } from 'react';
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Clock, ArrowRight, Shield, Building, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useLogin, loginSchema, LoginFormData } from '../api';
import { useAuthStore } from '../store';
import styles from './LoginForm.module.css';

export const LoginForm = () => {
<<<<<<< HEAD
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      login: 'admin@erp.uz',
      password: 'Admin123!'
    }
=======
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema)
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
  });

  const loginMutation = useLogin();
  const { loginAsDemo } = useAuthStore();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [companiesToSelect, setCompaniesToSelect] = useState<{ slug: string, name: string }[] | null>(null);

  useEffect(() => {
    if (retryCountdown > 0) {
      const timer = setTimeout(() => setRetryCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [retryCountdown]);

  const onSubmit = (data: LoginFormData) => {
    if (retryCountdown > 0) return;
    setGlobalError(null);

    loginMutation.mutate(data, {
      onError: (error: any) => {
        const errData = error?.response?.data;
        const status = error?.response?.status;
        const code = errData?.code;

        if (status === 429) {
          setRetryCountdown(15);
          if (code === 'LOGIN_LOCKED') {
            setGlobalError("Ko'p noto'g'ri urinishlar. Hisob 15 soniyaga bloklandi.");
          } else {
            setGlobalError("So'rovlar soni ko'p. Iltimos 15 soniyadan so'ng qayta urinib ko'ring.");
          }
        } else if (status === 409 && code === 'MULTIPLE_COMPANIES') {
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
            setGlobalError("Kirish taqiqlangan (403)");
          }
        } else if (status === 401 && code === 'INVALID_CREDENTIALS') {
          setGlobalError("Login yoki parol noto'g'ri");
        } else {
          setGlobalError("Login yoki parol noto'g'ri");
        }
      }
    });
  };

  const handleQuickFill = (role: 'ADMIN' | 'DIRECTOR' | 'WORKER') => {
    if (role === 'ADMIN') {
      setValue('login', 'admin@erp.uz');
      setValue('password', 'Admin123!');
      loginAsDemo('ADMIN');
    } else if (role === 'DIRECTOR') {
      setValue('login', 'director@erp.uz');
      setValue('password', 'Director123!');
      loginAsDemo('DIRECTOR');
    } else {
      setValue('login', 'worker@erp.uz');
      setValue('password', 'Worker123!');
      loginAsDemo('WORKER');
    }
  };

  if (companiesToSelect) {
    return (
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        <p style={{ fontSize: '14px', marginBottom: '8px', color: 'rgb(var(--foreground))' }}>
          Siz bir nechta kompaniyada mavjudsiz. Iltimos, faoliyat yuritmoqchi bo'lgan kompaniyani tanlang:
        </p>
        <select
          {...register('companySlug')}
          required
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 'var(--radius)',
            border: '1px solid rgb(var(--border))',
            backgroundColor: 'rgb(var(--card))',
            color: 'rgb(var(--foreground))'
          }}
        >
          <option value="">Kompaniyani tanlang...</option>
          {companiesToSelect.map(c => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>

        <Button type="submit" disabled={loginMutation.isPending} style={{ marginTop: '8px' }}>
          {loginMutation.isPending ? 'Kirilmoqda...' : 'Davom etish'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setCompaniesToSelect(null)}>
          Orqaga
        </Button>
      </form>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
        {globalError && (
          <div className={styles.errorAlert}>
            <AlertCircle size={18} />
            <span>{globalError}</span>
          </div>
        )}

        <Input
          label="Login (Email yoki Username)"
          placeholder="admin@erp.uz"
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

        <Button
          type="submit"
          disabled={loginMutation.isPending || retryCountdown > 0}
          style={{ marginTop: '4px', height: '44px' }}
        >
          {retryCountdown > 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> {retryCountdown}s kuting...
            </span>
          ) : loginMutation.isPending ? (
            'Tekshirilmoqda...'
          ) : (
            'Tizimga kirish'
          )}
        </Button>
      </form>

      {/* Demo Credentials Quick Switch */}
      <div className={styles.demoBox}>
        <div className={styles.demoTitle}>
          <span>Tezkor sinov hisoblari (Demo)</span>
          <span style={{ fontSize: '11px', color: 'rgb(var(--primary))' }}>1-bosishda kirish</span>
        </div>

        <div className={styles.demoGrid}>
          <button
            type="button"
            className={styles.demoCard}
            onClick={() => handleQuickFill('ADMIN')}
          >
            <div className={styles.demoInfo}>
              <span className={styles.demoRole}>
                <Shield size={14} color="rgb(var(--primary))" />
                Administrator (Admin)
              </span>
              <span className={styles.demoCreds}>admin@erp.uz • Admin123!</span>
            </div>
            <span className={styles.demoArrow}>Kirish <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          </button>

          <button
            type="button"
            className={styles.demoCard}
            onClick={() => handleQuickFill('DIRECTOR')}
          >
            <div className={styles.demoInfo}>
              <span className={styles.demoRole}>
                <Building size={14} color="#059669" />
                Filial Rahbari (Direktor)
              </span>
              <span className={styles.demoCreds}>director@erp.uz • Director123!</span>
            </div>
            <span className={styles.demoArrow}>Kirish <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          </button>

          <button
            type="button"
            className={styles.demoCard}
            onClick={() => handleQuickFill('WORKER')}
          >
            <div className={styles.demoInfo}>
              <span className={styles.demoRole}>
                <Smartphone size={14} color="#0284c7" />
                Xodim (Worker - Bot himoyasi)
              </span>
              <span className={styles.demoCreds}>worker@erp.uz • Worker123!</span>
            </div>
            <span className={styles.demoArrow}>Sinash <ArrowRight size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>
          </button>
        </div>
      </div>
    </div>
  );
};
