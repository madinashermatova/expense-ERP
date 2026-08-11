import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/features/auth/store';
import { DynamicsChart, CategoryPieChart } from './components/Charts';
import styles from './DashboardPage.module.css';

export const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PLATFORM_OWNER';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Davr tanlagich mock */}
          <select style={{ padding: '8px', borderRadius: '8px', border: '1px solid rgb(var(--border))' }}>
            <option>Shu oy</option>
            <option>O'tgan oy</option>
            <option>Yil</option>
          </select>
          <Button variant="secondary">Filtr</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Jami sarf (davr)</div>
            <div className={styles.kpiValue}>14 500 000 so'm</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Tasdiq kutayotgan (1-bosqich)</div>
            <div className={styles.kpiValue} style={{ color: 'rgb(var(--warning))' }}>12 ta</div>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardContent style={{ paddingTop: '24px' }}>
              <div className={styles.kpiLabel}>Yakuniy tasdiqda (2-bosqich)</div>
              <div className={styles.kpiValue} style={{ color: 'rgb(var(--info))' }}>5 ta</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent style={{ paddingTop: '24px' }}>
            <div className={styles.kpiLabel}>Byudjet bajarilishi</div>
            <div className={styles.kpiValue} style={{ color: 'rgb(var(--success))' }}>78%</div>
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
              <DynamicsChart />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kategoriyalar ulushi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={styles.chartContainer}>
              <CategoryPieChart />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
