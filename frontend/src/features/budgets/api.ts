import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { BudgetView, Paginated } from '@/lib/api/types';

export const useBudgets = () => {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<BudgetView>>(ENDPOINTS.BUDGETS);
      return response.data.items;
    }
  });
};

export const useCreateBudget = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(ENDPOINTS.BUDGETS, data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });
};
