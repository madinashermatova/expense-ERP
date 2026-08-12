import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useThemeStore } from '@/lib/themeStore';
import { useTranslation } from 'react-i18next';
import { Sun, Moon, Globe } from 'lucide-react';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  const { accessToken, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { i18n } = useTranslation();

  // If user is logged in (and not WORKER which gets handled), redirect to dashboard
  if (accessToken && user?.role !== 'WORKER') {
    return <Navigate to="/" replace />;
  }

  const handleLanguageToggle = () => {
    const nextLang = i18n.language === 'uz' ? 'ru' : 'uz';
    i18n.changeLanguage(nextLang);
  };

  return (
    <div className={styles.layout}>
      <div className={styles.topBar}>
        <button
          onClick={handleLanguageToggle}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            background: 'rgb(var(--card))',
            color: 'rgb(var(--foreground))',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          <Globe size={14} />
          {i18n.language.toUpperCase()}
        </button>

        <button
          onClick={toggleTheme}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            border: '1px solid rgb(var(--border))',
            background: 'rgb(var(--card))',
            color: 'rgb(var(--foreground))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          title={theme === 'dark' ? 'Yorug\' rejim' : 'Tungi rejim'}
        >
          {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} />}
        </button>
      </div>

      <Outlet />
    </div>
  );
};
