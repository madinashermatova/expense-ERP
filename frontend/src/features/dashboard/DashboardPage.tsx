import React, { useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { DynamicsChart, CategoryPieChart, BranchBarChart } from './components/Charts';
import {
  Wallet,
  Clock,
  CheckCircle,
  Undo2,
  TrendingUp,
  Building,
  Users,
  ArrowUpRight
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Link } from 'react-router-dom';
import styles from './DashboardPage.module.css';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  const [period, setPeriod] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState(isAdmin ? 'all' : (user?.branchId || 'b1'));

  // Top 5 employees spend ranking
  const topEmployees = [
    { id: '1', name: 'Farrux Shukurov', branch: 'Mirobod filiali', count: 18, total: '28 400 000 so\'m', percent: 92 },
    { id: '2', name: 'Sherzod Toirov', branch: 'Chilonzor filiali', count: 24, total: '22 400 000 so\'m', percent: 78 },
    { id: '3', name: 'Zarina Normatova', branch: 'Chilonzor filiali', count: 12, total: '19 800 000 so\'m', percent: 65 },
    { id: '4', name: 'Alisher Qodirov', branch: 'Chilonzor filiali', count: 15, total: '18 500 000 so\'m', percent: 62 },
    { id: '5', name: 'Bobur Mirzayev', branch: 'Yunusobod filiali', count: 9, total: '16 700 000 so\'m', percent: 55 },
  ];

  // Budget vs Actual categories
  const budgetItems = [
    { name: 'Marketing va reklama', actual: '38.5M', limit: '40.0M', percent: 96, status: 'warning' },
    { name: 'Transport va yoqilg\'i', actual: '16.4M', limit: '20.0M', percent: 82, status: 'warning' },
    { name: 'Ofis va ma\'muriy', actual: '9.8M', limit: '15.0M', percent: 65, status: 'success' },
    { name: 'IT va uskunalar', actual: '15.6M', limit: '15.0M', percent: 104, status: 'danger' },
  ];

  return (
    <div className={styles.container}>
      {/* Top Header Controls */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.headerTitle}>
            {isAdmin ? 'Kompaniya bo\'yicha umumiy sharh' : `${user?.branchName || 'Chilonzor filiali'} ko'rsatkichlari`}
          </h2>
          <span style={{ fontSize: '13px', color: 'rgb(var(--muted-foreground))' }}>
            Bugungi sana: 12-Avgust, 2026 • Real vaqt rejimida hisoblangan
          </span>
        </div>

        <div className={styles.controls}>
          {/* Branch selector (Disabled for Director as per TZ Section 2) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Building size={16} color="rgb(var(--muted-foreground))" />
            <select
              className={styles.periodSelect}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!isAdmin}
              title={!isAdmin ? "Direktor faqat o'z filialini ko'ra oladi" : undefined}
            >
              {isAdmin && <option value="all">Barcha filiallar (10 ta)</option>}
              <option value="b1">Chilonzor filiali</option>
              <option value="b2">Yunusobod filiali</option>
              <option value="b3">Mirobod filiali</option>
              <option value="b4">Samarqand filiali</option>
            </select>
          </div>

          {/* Period selector */}
          <select
            className={styles.periodSelect}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Bugun</option>
            <option value="week">Bu hafta</option>
            <option value="month">Shu oy (Avgust)</option>
            <option value="quarter">3-Chorak</option>
            <option value="year">2026-Yil</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {/* KPI 1: Total Spend */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Jami sarf-xarajat</span>
            <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
              <Wallet size={18} />
            </div>
          </div>
          <div className={styles.kpiValue}>
            {isAdmin ? '148 500 000' : '24 500 000'} <span style={{ fontSize: '14px', fontWeight: 600 }}>UZS</span>
          </div>
          <div className={styles.kpiFooter} style={{ color: 'rgb(var(--success))' }}>
            <TrendingUp size={14} />
            <span>+12.4% o'tgan oyga nisbatan</span>
          </div>
        </div>

        {/* KPI 2: 1-Stage Pending */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>1-bosqich tasdiqda</span>
            <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: 'rgb(var(--warning-foreground))' }}>
            4 <span style={{ fontSize: '14px', fontWeight: 600 }}>ta ariza</span>
          </div>
          <div className={styles.kpiFooter} style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>Direktor ko'rib chiqishi kutilmoqda</span>
          </div>
        </div>

        {/* KPI 3: 2-Stage Pending (Admin only) */}
        {isAdmin ? (
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>2-bosqich (Admin)</span>
              <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(14, 165, 233, 0.12)', color: '#0ea5e9' }}>
                <CheckCircle size={18} />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: '#0284c7' }}>
              2 <span style={{ fontSize: '14px', fontWeight: 600 }}>ta ariza</span>
            </div>
            <div className={styles.kpiFooter} style={{ color: 'rgb(var(--muted-foreground))' }}>
              <span>Yakuniy to'lov uchun tayyor</span>
            </div>
          </div>
        ) : (
          <div className={styles.kpiCard}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Xodimlar faolligi</span>
              <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>
                <Users size={18} />
              </div>
            </div>
            <div className={styles.kpiValue}>
              14 <span style={{ fontSize: '14px', fontWeight: 600 }}>xodim</span>
            </div>
            <div className={styles.kpiFooter} style={{ color: 'rgb(var(--success))' }}>
              <span>Barcha xodimlar faol</span>
            </div>
          </div>
        )}

        {/* KPI 4: Refunded */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Qaytarilgan summa</span>
            <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <Undo2 size={18} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: 'rgb(var(--success))' }}>
            2 350 000 <span style={{ fontSize: '14px', fontWeight: 600 }}>UZS</span>
          </div>
          <div className={styles.kpiFooter} style={{ color: 'rgb(var(--muted-foreground))' }}>
            <span>Kassaga qaytgan mablag'lar</span>
          </div>
        </div>

        {/* KPI 5: Budget Execution */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Byudjet ijrosi</span>
            <div className={styles.kpiIcon} style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={styles.kpiValue} style={{ color: 'rgb(var(--success))' }}>
            78%
          </div>
          <div style={{ width: '100%', height: '6px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '78%', height: '100%', backgroundColor: 'rgb(var(--success))' }} />
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className={styles.chartsGrid}>
        {/* Dynamic Area Chart (12 months) */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Xarajatlar dinamikasi (Oxirgi 12 oy)</h3>
              <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                Oylar kesimidagi umumiy xarajatlar tendensiyasi
              </span>
            </div>
            <Link to="/reports" style={{ fontSize: '12.5px', color: 'rgb(var(--primary))', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Hisobotlar <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className={styles.chartBody}>
            <DynamicsChart />
          </div>
        </div>

        {/* Category Share Donut Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Kategoriyalar ulushi</h3>
              <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                Asosiy xarajat yo'nalishlari
              </span>
            </div>
          </div>
          <div className={styles.chartBody}>
            <CategoryPieChart />
          </div>
        </div>
      </div>

      {/* ADMIN Section: Branch Comparisons & Tables */}
      {isAdmin && (
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <div>
              <h3 className={styles.chartTitle}>Filiallar bo'yicha xarajat va limit taqqoslovi (Mln UZS)</h3>
              <span style={{ fontSize: '12px', color: 'rgb(var(--muted-foreground))' }}>
                Filiallarning oylik limitga nisbatan real sarfi
              </span>
            </div>
            <Link to="/branches" style={{ fontSize: '12.5px', color: 'rgb(var(--primary))', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Filiallar ro'yxati <ArrowUpRight size={14} />
            </Link>
          </div>
          <div style={{ height: '260px' }}>
            <BranchBarChart />
          </div>
        </div>
      )}

      {/* Ranking & Budget Breakdown Grid */}
      <div className={styles.tablesGrid}>
        {/* TOP-5 Employees */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>TOP-5 Eng ko'p xarajat qilgan xodimlar</h3>
            <Link to="/employees" style={{ fontSize: '12.5px', color: 'rgb(var(--primary))', fontWeight: 600, textDecoration: 'none' }}>
              Barchasi
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Xodim</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead style={{ textAlign: 'right' }}>Jami sarf</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topEmployees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgb(var(--muted-foreground))' }}>{emp.count} ta xarajat</div>
                  </TableCell>
                  <TableCell>{emp.branch}</TableCell>
                  <TableCell style={{ textAlign: 'right', fontWeight: 700, color: 'rgb(var(--primary))' }}>
                    {emp.total}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Budget vs Actual Breakdown */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Kategoriyalar: Byudjet vs Fakt</h3>
            <Link to="/budgets" style={{ fontSize: '12.5px', color: 'rgb(var(--primary))', fontWeight: 600, textDecoration: 'none' }}>
              Limitlar
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {budgetItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600 }}>
                  <span>{item.name}</span>
                  <span>
                    {item.actual} / {item.limit}{' '}
                    <span style={{
                      color: item.status === 'danger' ? 'rgb(var(--destructive))' : item.status === 'warning' ? '#d97706' : 'rgb(var(--success))',
                      fontWeight: 700
                    }}>
                      ({item.percent}%)
                    </span>
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'rgb(var(--muted))', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, item.percent)}%`,
                    backgroundColor: item.status === 'danger' ? 'rgb(var(--destructive))' : item.status === 'warning' ? '#f59e0b' : 'rgb(var(--success))',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
