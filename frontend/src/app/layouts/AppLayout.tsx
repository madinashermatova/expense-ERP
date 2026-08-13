import React, { useState } from 'react';
import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useLogin, useLogout, useAuthMe } from '@/features/auth/api';
import { useThemeStore } from '@/lib/themeStore';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Receipt,
  CheckCircle2,
  Undo2,
  FileEdit,
  Building2,
  Users2,
  FolderTree,
  PieChart,
  BarChart3,
  Coins,
  ShieldCheck,
  FileSpreadsheet,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  LogOut,
  Send,
  UserCheck,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import styles from './AppLayout.module.css';

export const AppLayout = () => {
  const { accessToken, user } = useAuthStore();
  const logoutMutation = useLogout();
  const loginMutation = useLogin();
  useAuthMe(); // Automatically verifies and synchronizes user profile via GET /api/auth/me
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const { i18n } = useTranslation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  // WORKER Web ERP guard (TZ Section 3: Worker cannot use Web ERP)
  if (user?.role === 'WORKER') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgb(var(--background))'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          padding: '36px',
          backgroundColor: 'rgb(var(--card))',
          borderRadius: '16px',
          border: '1px solid rgb(var(--border))',
          textAlign: 'center',
          boxShadow: 'var(--shadow-xl)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <Send size={32} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            Kirish cheklangan (Telegram Bot)
          </h2>
          <p style={{ fontSize: '14px', color: 'rgb(var(--muted-foreground))', lineHeight: 1.6, marginBottom: '24px' }}>
            <strong>{user.fullName}</strong> ({user.role}) — Ushbu tizim xodimlar (Worker) uchun faqat rasmiy <strong>Telegram bot</strong> orqali ishlaydi. Web ERP faqat rahbarlar va administratorlar uchun mo'ljallangan.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Button
              onClick={() => loginMutation.mutate({ login: 'admin1@alfa.uz', password: 'Parol123!' })}
              style={{ width: '100%', gap: '8px' }}
            >
              <UserCheck size={16} /> Admin sifatida sinab ko'rish
            </Button>
            <Button
              variant="secondary"
              onClick={() => loginMutation.mutate({ login: 'director.chl@alfa.uz', password: 'Parol123!' })}
              style={{ width: '100%' }}
            >
              Direktor sifatida sinab ko'rish
            </Button>
            <Button
              variant="ghost"
              onClick={() => logoutMutation.mutate()}
              style={{ width: '100%', color: 'rgb(var(--destructive))' }}
            >
              <LogOut size={16} /> Tizimdan chiqish
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  const handleRoleChange = (role: 'ADMIN' | 'DIRECTOR' | 'WORKER') => {
    if (role === 'ADMIN') {
      loginMutation.mutate({ login: 'admin1@alfa.uz', password: 'Parol123!' });
    } else if (role === 'DIRECTOR') {
      loginMutation.mutate({ login: 'director.chl@alfa.uz', password: 'Parol123!' });
    } else {
      loginMutation.mutate({ login: 'worker1@alfa.uz', password: 'Parol123!' });
    }
  };

  const handleLanguageToggle = () => {
    const nextLang = i18n.language === 'uz' ? 'ru' : 'uz';
    i18n.changeLanguage(nextLang);
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => navigate('/login')
    });
  };

  // Dynamic titles
  const getPageMeta = (pathname: string) => {
    switch (pathname) {
      case '/': return { title: 'Boshqaruv paneli (Dashboard)', crumb: 'Dashboard' };
      case '/expenses': return { title: 'Xarajatlar reestri', crumb: 'Moliya / Xarajatlar' };
      case '/expenses/create': return { title: 'Yangi xarajat kiritish', crumb: 'Moliya / Xarajatlar / Yangi' };
      case '/approvals': return { title: 'Tasdiqlash navbati', crumb: 'Moliya / Tasdiqlash' };
      case '/refunds': return { title: 'Qaytarish so\'rovlari', crumb: 'Moliya / Qaytarishlar' };
      case '/edit-requests': return { title: 'Tahrirlash murojaatlari', crumb: 'Moliya / Tahrirlash' };
      case '/branches': return { title: 'Filiallar boshqaruvi', crumb: 'Tashkilot / Filiallar' };
      case '/employees': return { title: 'Xodimlar va rollar', crumb: 'Tashkilot / Xodimlar' };
      case '/categories': return { title: 'Kategoriyalar daraxti', crumb: 'Tashkilot / Kategoriyalar' };
      case '/budgets': return { title: 'Byudjet limitlari va nazorat', crumb: 'Tashkilot / Byudjetlar' };
      case '/reports': return { title: 'Hisobotlar konstruktori', crumb: 'Tahlil / Hisobotlar' };
      case '/currency': return { title: 'Valyuta kurslari', crumb: 'Tahlil / Valyutalar' };
      case '/exports': return { title: 'Eksportlar tarixi', crumb: 'Tahlil / Eksportlar' };
      case '/users': return { title: 'Foydalanuvchilar va huquqlar', crumb: 'Tizim / Foydalanuvchilar' };
      case '/audit': return { title: 'Audit va xavfsizlik jurnali', crumb: 'Tizim / Audit jurnali' };
      case '/settings': return { title: 'Tizim sozlamalari', crumb: 'Tizim / Sozlamalar' };
      case '/profile': return { title: 'Shaxsiy profil', crumb: 'Foydalanuvchi / Profil' };
      default: return { title: 'Web ERP', crumb: 'Bosh sahifa' };
    }
  };

  const currentMeta = getPageMeta(location.pathname);

  return (
    <div className={styles.layout}>
      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}>
        <div className={styles.brand}>
          <NavLink to="/" className={styles.logoContainer} onClick={() => setMobileOpen(false)}>
            <div className={styles.logoIcon}>E</div>
            {!collapsed && (
              <div className={styles.logoText}>
                <span className={styles.logoTitle}>Expense ERP</span>
                <span className={styles.logoSubtitle}>Moliya Boshqaruvi</span>
              </div>
            )}
          </NavLink>

          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Kengaytirish' : 'Yig\'ish'}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className={styles.navContainer}>
          {/* Section: Overview */}
          {!collapsed && <div className={styles.sectionHeader}>Asosiy</div>}
          <NavLink
            to="/"
            end
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Dashboard"
          >
            <LayoutDashboard size={18} />
            {!collapsed && <span>Dashboard</span>}
          </NavLink>

          {/* Section: Finance */}
          {!collapsed && <div className={styles.sectionHeader}>Moliya</div>}
          <NavLink
            to="/expenses"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Xarajatlar"
          >
            <Receipt size={18} />
            {!collapsed && <span>Xarajatlar</span>}
          </NavLink>

          <NavLink
            to="/approvals"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Tasdiqlash navbati"
          >
            <CheckCircle2 size={18} />
            {!collapsed && <span>Tasdiqlash</span>}
            {!collapsed && <span className={styles.itemBadge}>4</span>}
          </NavLink>

          <NavLink
            to="/refunds"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Qaytarishlar"
          >
            <Undo2 size={18} />
            {!collapsed && <span>Qaytarishlar</span>}
            {!collapsed && <span className={styles.itemBadge} style={{ backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0284c7' }}>2</span>}
          </NavLink>

          <NavLink
            to="/edit-requests"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Tahrirlash murojaatlari"
          >
            <FileEdit size={18} />
            {!collapsed && <span>Tahrirlash</span>}
            {!collapsed && <span className={styles.itemBadge} style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#b45309' }}>1</span>}
          </NavLink>

          {/* Section: Organization */}
          {!collapsed && <div className={styles.sectionHeader}>Tashkilot</div>}
          {isAdmin && (
            <NavLink
              to="/branches"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setMobileOpen(false)}
              title="Filiallar"
            >
              <Building2 size={18} />
              {!collapsed && <span>Filiallar</span>}
            </NavLink>
          )}

          <NavLink
            to="/employees"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Xodimlar"
          >
            <Users2 size={18} />
            {!collapsed && <span>Xodimlar</span>}
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/categories"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setMobileOpen(false)}
              title="Kategoriyalar"
            >
              <FolderTree size={18} />
              {!collapsed && <span>Kategoriyalar</span>}
            </NavLink>
          )}

          {isAdmin && (
            <NavLink
              to="/budgets"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setMobileOpen(false)}
              title="Byudjetlar"
            >
              <PieChart size={18} />
              {!collapsed && <span>Byudjetlar</span>}
            </NavLink>
          )}

          {/* Section: Analytics & Reports */}
          {!collapsed && <div className={styles.sectionHeader}>Tahlil & Hisobot</div>}
          <NavLink
            to="/reports"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Hisobotlar"
          >
            <BarChart3 size={18} />
            {!collapsed && <span>Hisobotlar</span>}
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/currency"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              onClick={() => setMobileOpen(false)}
              title="Valyuta kurslari"
            >
              <Coins size={18} />
              {!collapsed && <span>Valyuta kurslari</span>}
            </NavLink>
          )}

          <NavLink
            to="/exports"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            onClick={() => setMobileOpen(false)}
            title="Eksportlar tarixi"
          >
            <FileSpreadsheet size={18} />
            {!collapsed && <span>Eksportlar</span>}
          </NavLink>

          {/* Section: System (Admin Only) */}
          {isAdmin && (
            <>
              {!collapsed && <div className={styles.sectionHeader}>Tizim</div>}
              <NavLink
                to="/users"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setMobileOpen(false)}
                title="Foydalanuvchilar"
              >
                <Users2 size={18} />
                {!collapsed && <span>Foydalanuvchilar</span>}
              </NavLink>

              <NavLink
                to="/audit"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setMobileOpen(false)}
                title="Audit jurnali"
              >
                <ShieldCheck size={18} />
                {!collapsed && <span>Audit jurnali</span>}
              </NavLink>

              <NavLink
                to="/settings"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => setMobileOpen(false)}
                title="Sozlamalar"
              >
                <Settings size={18} />
                {!collapsed && <span>Sozlamalar</span>}
              </NavLink>
            </>
          )}
        </nav>

        {/* Footer Branch Tag */}
        {!collapsed && (
          <div className={styles.branchFooter}>
            <div className={styles.branchDot} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600, color: 'rgb(var(--foreground))' }}>
                {user?.branchName || 'Bosh Ofis'}
              </span>
              <span style={{ fontSize: '11px' }}>
                {user?.role === 'ADMIN' ? 'Barcha filiallar huquqi' : 'Filial rejimi'}
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.mobileMenuBtn}
              onClick={() => setMobileOpen(true)}
              title="Menyu"
            >
              <Menu size={20} />
            </button>

            <div className={styles.pageHeading}>
              <h1 className={styles.pageTitle}>{currentMeta.title}</h1>
              <span className={styles.breadcrumbs}>{currentMeta.crumb}</span>
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Quick Demo Role Switcher */}
            <div className={styles.roleBadgeSelector} title="Rolni almashtirish">
              <span style={{ color: 'rgb(var(--muted-foreground))', fontSize: '11px' }}>Rol:</span>
              <select
                className={styles.roleSelect}
                value={user?.role}
                onChange={(e) => handleRoleChange(e.target.value as any)}
              >
                <option value="ADMIN">👑 Admin (Barcha huquqlar)</option>
                <option value="DIRECTOR">🏢 Direktor (Chilonzor)</option>
                <option value="WORKER">📱 Xodim (Worker - Bot)</option>
              </select>
            </div>

            {/* Language Switcher */}
            <button
              className={styles.iconBtn}
              onClick={handleLanguageToggle}
              title={`Til: ${i18n.language.toUpperCase()} (Almashtirish uchun bosing)`}
              style={{ fontWeight: 700, fontSize: '12px' }}
            >
              <Globe size={14} style={{ marginRight: '2px' }} />
              {i18n.language.toUpperCase()}
            </button>

            {/* Dark / Light Toggle */}
            <button
              className={styles.iconBtn}
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Yorug\' rejim' : 'Tungi rejim'}
            >
              {theme === 'dark' ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} />}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Profile Avatar Button */}
            <NavLink to="/profile" className={styles.userProfileBtn} title="Profil">
              <div className={styles.userAvatar}>
                {user?.fullName?.charAt(0) || 'U'}
              </div>
              <span className={styles.userName}>{user?.fullName || 'Foydalanuvchi'}</span>
            </NavLink>

            {/* Logout Button */}
            <button
              className={styles.iconBtn}
              onClick={handleLogout}
              title="Chiqish"
              style={{ color: 'rgb(var(--destructive))' }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};
