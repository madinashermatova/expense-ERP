import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useAuthStore } from '@/features/auth/store';
import { DynamicsChart, CategoryPieChart } from './components/Charts';
import { useDashboardStats, useDashboardCharts } from './api';
import styles from './DashboardPage.module.css';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';
  const [period, setPeriod] = React.useState('this_month');

  const { data: stats, isLoading: statsLoading } = useDashboardStats(period);
  const { data: charts, isLoading: chartsLoading } = useDashboardCharts(period);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Davr tanlagich */}
          <select 
            value={period}
            onChange={e => setPeriod(e.target.value)}
            style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgb(var(--border))' }}
          >
            <option value="this_month">Shu oy</option>
            <option value="last_month">O'tgan oy</option>
            <option value="year">Yil</option>
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Jami sarf (davr)</div>
            <div className={styles.kpiValue}>
              {statsLoading ? '...' : `${new Intl.NumberFormat('uz-UZ').format(stats?.totalExpense || 0)} so'm`}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Tasdiq kutayotgan (1-bosqich)</div>
            <div className={styles.kpiValue} style={{ color: 'rgb(var(--warning))' }}>
              {statsLoading ? '...' : `${stats?.pending1 || 0} ta`}
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent style={{ paddingTop: '24px' }}>
              <div className={styles.kpiLabel}>Yakuniy tasdiqda (2-bosqich)</div>
              <div className={styles.kpiValue} style={{ color: 'rgb(var(--info))' }}>
                {statsLoading ? '...' : `${stats?.pending2 || 0} ta`}
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Byudjet bajarilishi</div>
            <div className={styles.kpiValue} style={{ color: 'rgb(var(--success))' }}>
              {statsLoading ? '...' : `${stats?.budgetPercent || 0}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        <Card>
          <CardHeader>
            <CardTitle>Xarajatlar dinamikasi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.chartContainer}>
              {chartsLoading ? <div>Yuklanmoqda...</div> : <DynamicsChart data={charts?.dynamics || []} />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kategoriyalar ulushi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.chartContainer}>
              {chartsLoading ? <div>Yuklanmoqda...</div> : <CategoryPieChart data={charts?.categories || []} />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
