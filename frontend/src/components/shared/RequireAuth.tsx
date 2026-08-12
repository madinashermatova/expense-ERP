import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { accessToken, user } = useAuthStore();
  const location = useLocation();

  if (!accessToken || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // WORKER Web ERP ga umuman kira olmaydi
  if (user.role === 'WORKER') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Kirish taqiqlangan</h2>
        <p>Bu tizim faqat Telegram bot orqali ishlaydi.</p>
        <button 
          onClick={() => useAuthStore.getState().clearAuth()}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
        >
          Chiqish
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
