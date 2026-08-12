import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  categoryId?: string;
  employeeId?: string;
  status?: string | string[];
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: string;
  currency?: string;
  q?: string;
  from?: string;
  to?: string;
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

export const useBranches = (status: string = 'active') => {
  return useQuery({
    queryKey: ['branches', status],
    queryFn: async () => {
      const response = await apiClient.get('/branches', { params: { status } });
      return response.data.items || response.data;
    }
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get('/categories');
      return response.data;
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

export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/expenses/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });
};

export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.post(`/expenses/${id}/reject`, { reason });
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
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.post(`/expenses/${id}/request-fix`, { reason });
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
      const response = await apiClient.post('/expenses/bulk-approve', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useCreateExport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; format: 'xlsx' | 'pdf'; filters: any }) => {
      const response = await apiClient.post('/exports', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    }
  });
};
