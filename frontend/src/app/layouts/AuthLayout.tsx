import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import styles from './AuthLayout.module.css';

export const AuthLayout = () => {
  const { accessToken } = useAuthStore();

  if (accessToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.layout}>
      <Outlet />
    </div>
  );
};
