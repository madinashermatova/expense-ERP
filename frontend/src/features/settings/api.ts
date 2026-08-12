import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/branches', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] })
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/categories', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] })
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/employees', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] })
  });
};
