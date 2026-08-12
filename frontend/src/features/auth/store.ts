import { create } from 'zustand';

export interface User {
  id: string;
  login: string;
  role: 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';
  branchId?: string;
  branchName?: string;
  fullName: string;
  email?: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  loginAsDemo: (role: 'ADMIN' | 'DIRECTOR' | 'WORKER') => void;
}

const defaultAdminUser: User = {
  id: 'u1',
  login: 'admin',
  fullName: 'Bekzod Abdullayev',
  role: 'ADMIN',
  branchId: 'b1',
  branchName: 'Chilonzor filiali',
  email: 'admin@erp.uz'
};

const defaultDirectorUser: User = {
  id: 'u2',
  login: 'director_chl',
  fullName: 'Rustam Rahimov',
  role: 'DIRECTOR',
  branchId: 'b1',
  branchName: 'Chilonzor filiali',
  email: 'director@erp.uz'
};

const defaultWorkerUser: User = {
  id: 'u10',
  login: 'worker_chl',
  fullName: 'Alisher Qodirov',
  role: 'WORKER',
  branchId: 'b1',
  branchName: 'Chilonzor filiali',
  email: 'worker@erp.uz'
};

export const useAuthStore = create<AuthState>((set) => ({
  // Default initialized with Admin so the entire app is immediately testable and navigable
  user: defaultAdminUser,
  accessToken: 'mock-initial-token-admin',
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ user: null, accessToken: null }),
  loginAsDemo: (role) => {
    if (role === 'ADMIN') {
      set({ user: defaultAdminUser, accessToken: 'mock-admin-token-' + Date.now() });
    } else if (role === 'DIRECTOR') {
      set({ user: defaultDirectorUser, accessToken: 'mock-director-token-' + Date.now() });
    } else {
      set({ user: defaultWorkerUser, accessToken: 'mock-worker-token-' + Date.now() });
    }
  }
}));
