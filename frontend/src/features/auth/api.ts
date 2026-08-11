import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from './store';
import { z } from 'zod';

export const loginSchema = z.object({
  login: z.string().min(1, { message: "Login bo'sh bo'lishi mumkin emas" }),
  password: z.string().min(8, { message: "Parol kamida 8 ta belgidan iborat bo'lishi kerak" }),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const useLogin = () => {
  const { setAccessToken, setUser } = useAuthStore();

  return useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiClient.post('/auth/login', data);
      return response.data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
};

export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      clearAuth();
    }
  });
};
