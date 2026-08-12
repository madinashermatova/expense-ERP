import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
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

export const useBudgets = () => {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const response = await apiClient.get('/budgets');
      return response.data;
    }
  });
};

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/budgets', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });
};

export const useCurrencies = () => {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const response = await apiClient.get('/currencies');
      return response.data;
    }
  });
};

export const useCreateCurrency = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post('/currencies', data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] })
  });
};
