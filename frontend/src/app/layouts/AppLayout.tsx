import React, { useState } from 'react';
import { Outlet, Navigate, NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useLogout } from '@/features/auth/api';
import { LayoutDashboard, Receipt, CheckCircle, Menu, LogOut, Settings, Undo2, PencilLine, BarChart3, DownloadCloud } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const { accessToken, user } = useAuthStore();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && collapsed) setCollapsed(false);
      if (mobile && !collapsed) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [collapsed]);

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
    { to: '/refunds', icon: <Undo2 size={20} />, label: "Qaytarishlar" },
    { to: '/edit-requests', icon: <PencilLine size={20} />, label: "Tahrirlash" },
    { to: '/reports', icon: <BarChart3 size={20} />, label: "Hisobotlar" },
    { to: '/audit', icon: <Settings size={20} />, label: "Audit jurnali" },
    { to: '/exports', icon: <DownloadCloud size={20} />, label: "Eksportlar" },
  ];

  if (user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER') {
    menuItems.push({ to: '/settings', icon: <Settings size={20} />, label: 'Sozlamalar' });
  }

  return (
    <div className={styles.layout}>
      {/* Mobile backdrop */}
      {!collapsed && (
        <div 
          className={styles.backdrop} 
          onClick={() => setCollapsed(true)} 
        />
      )}
      
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div style={{ padding: collapsed ? '16px 0' : '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', borderBottom: '1px solid rgb(var(--border))', height: '56px' }}>
          {!collapsed && <span>Web ERP</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--foreground))', display: 'flex' }}>
            <Menu size={20} />
          </button>
        </div>
        <nav style={{ padding: collapsed ? '16px 8px' : '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => {
                if (isMobile) setCollapsed(true);
              }}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: isActive ? 'rgb(var(--primary))' : 'rgb(var(--foreground))',
                backgroundColor: isActive ? 'rgb(var(--primary-subtle))' : 'transparent',
                fontWeight: isActive ? 600 : 400
              })}
            >
              <div style={{ display: 'flex', flexShrink: 0 }}>
                {item.icon}
              </div>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      
      <main className={styles.main}>
        <header className={styles.header}>
          {/* Mobile hamburger icon */}
          <button 
            className={styles.mobileMenuBtn} 
            onClick={() => setCollapsed(!collapsed)} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--foreground))', display: isMobile ? 'block' : 'none', marginRight: 'auto' }}
          >
            <Menu size={24} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: !isMobile ? 'auto' : '0' }}>
            <select 
              value={localStorage.getItem('language') || 'uz'} 
              onChange={(e) => {
                localStorage.setItem('language', e.target.value);
                window.location.reload();
              }}
              style={{ background: 'transparent', border: '1px solid rgb(var(--border))', borderRadius: '4px', padding: '4px 8px', color: 'rgb(var(--foreground))' }}
            >
              <option value="uz">UZ</option>
              <option value="ru">RU</option>
            </select>
            
            <select 
              value={localStorage.getItem('theme') || 'system'} 
              onChange={(e) => {
                const newTheme = e.target.value;
                localStorage.setItem('theme', newTheme);
                if (newTheme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
              style={{ background: 'transparent', border: '1px solid rgb(var(--border))', borderRadius: '4px', padding: '4px 8px', color: 'rgb(var(--foreground))' }}
            >
              <option value="system">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>

            <NotificationBell />
            <Link to="/profile" className={styles.hideOnMobile} style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}>
              {user?.fullName || 'Foydalanuvchi'}
            </Link>
            <Button variant="ghost" onClick={handleLogout} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <LogOut size={16} />
              <span className={styles.hideOnMobile}>Chiqish</span>
            </Button>
          </div>
        </header>
        
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
