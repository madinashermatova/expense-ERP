import { useAuthStore } from '@/features/auth/store';
import { Role, Action, can } from '@/lib/permissions';

interface RoleGateProps {
  roles?: Role[];
  action?: Action;
  children: React.ReactNode;
}

export const RoleGate = ({ roles, action, children }: RoleGateProps) => {
  const { user } = useAuthStore();

  if (!user) {
    return null;
  }

  // Agar roles berilgan bo'lsa, foydalanuvchi roli shular ro'yxatida ekanini tekshiramiz
  if (roles && !roles.includes(user.role)) {
    return null;
  }

  // Agar action berilgan bo'lsa, action ruxsat etilganini tekshiramiz
  if (action && !can(user.role, action)) {
    return null;
  }

  return <>{children}</>;
};
