import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { BulkApproveResult } from '@/lib/api/types';

export const usePendingExpenses = (stage: '1' | '2') => {
  return useQuery({
    queryKey: ['expenses', 'pending', stage],
    queryFn: async () => {
      // Mocked endpoint using standard expenses list but filtering
      const status = stage === '1' ? 'DIRECTOR_PENDING' : 'ADMIN_PENDING';
      const response = await apiClient.get('/expenses', { params: { status, limit: 50 } });
      return response.data;
    }
  });
};

export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/approve`, { version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useBulkApproveExpenses = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiClient.post<BulkApproveResult>('/expenses/bulk-approve', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, version }: { id: string; reason: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/reject`, { reason, version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useRequestFixExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, version }: { id: string; reason: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/request-fix`, { reason, version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};
