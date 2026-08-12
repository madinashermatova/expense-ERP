
import { useAuthStore } from '@/features/auth/store';
import { Role } from '@/lib/permissions';

export const RequireRole = ({ roles, children }: { roles: Role[], children: React.ReactNode }) => {
  const { user } = useAuthStore();


  if (!user || !roles.includes(user.role)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Kirish taqiqlangan (403)</h2>
        <p>Sizda ushbu sahifani ko'rish huquqi yo'q.</p>
        <button 
          onClick={() => window.history.back()}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
        >
          Orqaga qaytish
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
