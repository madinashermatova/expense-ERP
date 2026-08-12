import React, { useState } from 'react';
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useLogout } from '@/features/auth/api';
import { LayoutDashboard, Receipt, CheckCircle, Menu, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const { accessToken, user } = useAuthStore();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'WORKER') {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <h2>Kirish taqiqlangan</h2>
        <p>Bu tizim faqat Telegram bot orqali ishlaydi.</p>
        <Button onClick={() => logoutMutation.mutate()}>Chiqish</Button>
      </div>
    );
  }

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/login')
    });
  };

  const menuItems = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/expenses', icon: <Receipt size={20} />, label: 'Xarajatlar' },
    { to: '/approvals', icon: <CheckCircle size={20} />, label: 'Tasdiqlash' },
  ];

  if (user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER') {
    menuItems.push({ to: '/settings', icon: <Settings size={20} />, label: 'Sozlamalar' });
  }

  return (
    <div className={styles.layout}>
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div style={{ padding: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--border))', height: '56px' }}>
          {!collapsed && <span>Web ERP</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--foreground))' }}>
            <Menu size={20} />
          </button>
        </div>
        <nav style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
                backgroundColor: isActive ? 'rgb(var(--primary-subtle))' : 'transparent',
                fontWeight: isActive ? 600 : 400
              })}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      
      <main className={styles.main}>
        <header className={styles.header}>
          <div style={{ fontWeight: 500 }}>{user?.fullName || 'Foydalanuvchi'}</div>
          <Button variant="ghost" onClick={handleLogout} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LogOut size={16} />
            Chiqish
          </Button>
        </header>
        
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
