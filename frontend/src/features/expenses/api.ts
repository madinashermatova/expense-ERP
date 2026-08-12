import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ExpenseListParams {
  page: number;
  limit: number;
}

export const useExpenses = (params: ExpenseListParams) => {
  return useQuery({
    queryKey: ['expenses', 'list', params],
    queryFn: async () => {
      const response = await apiClient.get('/expenses', { params });
      return response.data;
    }
  });
};

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return response.data.items || response.data; // fallback for old mock
    }
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get('/categories');
      return response.data; // returns array directly
    }
  });
};

export const useEmployees = (branchId?: string) => {
  return useQuery({
    queryKey: ['employees', branchId],
    queryFn: async () => {
      const response = await apiClient.get('/employees', { params: { branchId } });
      return response.data.items || response.data;
    },
    enabled: branchId !== undefined ? !!branchId : true
  });
};

