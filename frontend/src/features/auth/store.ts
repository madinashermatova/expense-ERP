import { create } from 'zustand';

interface User {
  id: string;
  login: string;
  role: 'PLATFORM_OWNER' | 'ADMIN' | 'DIRECTOR' | 'WORKER';
  branchId?: string;
  fullName: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),
  setUser: (user) => set({ user }),
  clearAuth: () => set({ user: null, accessToken: null }),
}));
