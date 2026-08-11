import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const { accessToken, user } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // Ensure WORKER cannot access Web ERP
  if (user?.role === 'WORKER') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>Kirish taqiqlangan</h2>
        <p>Bu tizim faqat Telegram bot orqali ishlaydi.</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div style={{ padding: '16px', fontWeight: 'bold' }}>Web ERP</div>
        {/* Sidebar Nav Items go here */}
      </aside>
      
      <main className={styles.main}>
        <header className={styles.header}>
          <div>Qidiruv...</div>
          <div>Profil / Chiqish</div>
        </header>
        
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
