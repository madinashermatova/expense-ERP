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
