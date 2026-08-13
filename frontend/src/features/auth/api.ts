import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore, User } from './store';
import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().min(1, { message: "Login bo'sh bo'lishi mumkin emas" }),
  password: z.string().min(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" }),
  companySlug: z.string().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export interface LoginResponse {
  accessToken: string;
  user: User;
}

// 1. POST /api/auth/login
export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LoginFormData): Promise<LoginResponse> => {
      const response = await apiClient.post<LoginResponse>('/auth/login', data);
      return response.data;
    },
    onSuccess: (data) => {
      setAuth(data.accessToken, data.user);
      queryClient.setQueryData(['auth', 'me'], data.user);
      queryClient.invalidateQueries();
    },
  });
};

// 2. POST /api/auth/logout
export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await apiClient.post('/auth/logout');
      } catch (e) {
        // Even if server returns error during logout, client state should be cleared
      }
    },
    onSettled: () => {
      clearAuth();
      queryClient.clear();
    }
  });
};

// 3. GET /api/auth/me
export const fetchAuthMe = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
};

export const useAuthMe = () => {
  const { accessToken, setUser } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await fetchAuthMe();
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};

// 4. POST /api/auth/refresh
export const refreshAuth = async (): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/refresh');
  const { accessToken, user } = response.data;
  useAuthStore.getState().setAccessToken(accessToken);
  if (user) {
    useAuthStore.getState().setUser(user);
  }
  return response.data;
};

export const useRefreshToken = () => {
  return useMutation({
    mutationFn: refreshAuth,
  });
};

