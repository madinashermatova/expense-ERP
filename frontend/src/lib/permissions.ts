export type Role = 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';

export type Action =
  | 'manage:branches'
  | 'manage:categories'
  | 'manage:budgets'
  | 'manage:currency'
  | 'manage:users'
  | 'manage:settings'
  | 'view:audit'
  | 'delete:expense'
  | 'approve:stage2';

const rolePermissions: Record<Role, Action[]> = {
  PLATFORM_OWNER: [],
  ADMIN: [
    'manage:branches',
    'manage:categories',
    'manage:budgets',
    'manage:currency',
    'manage:users',
    'manage:settings',
    'view:audit',
    'delete:expense',
    'approve:stage2',
  ],
  DIRECTOR: [],
  WORKER: [],
};

export const can = (role: Role | undefined, action: Action): boolean => {
  if (!role) return false;
  return rolePermissions[role]?.includes(action) ?? false;
};
