import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email?: string;
  username?: string;
  login?: string;
  role: 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';
  language?: 'UZ' | 'RU' | 'uz' | 'ru';
  companyId?: string;
  companyName?: string;
  employeeId?: string;
  fullName: string;
  branchId?: string | null;
  branchName?: string | null;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setAuth: (accessToken: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      setAccessToken: (token) => set({ accessToken: token }),
      setUser: (user) => set({ user }),
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clearAuth: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'erp_auth_storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
    }
  )
);

