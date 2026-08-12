import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useRefunds = (status?: string) => {
  return useQuery({
    queryKey: ['refunds', status],
    queryFn: async () => {
      const { data } = await apiClient.get('/refunds', { params: { status } });
      return data;
    }
  });
};

export const useApproveRefund = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/refunds/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    }
  });
};

export const useRejectRefund = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.post(`/refunds/${id}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    }
  });
};

export const useCreateRefund = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await apiClient.post('/refunds', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useEmployeesForRefund = () => {
  return useQuery({
    queryKey: ['employees', 'for-refund'],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params: { status: 'ACTIVE', limit: 1000 } });
      return data;
    }
  });
};

export const useApprovedExpensesForEmployee = (employeeId?: string) => {
  return useQuery({
    queryKey: ['expenses', 'approved', employeeId],
    queryFn: async () => {
      const { data } = await apiClient.get('/expenses', { params: { status: 'APPROVED', employeeId, limit: 1000 } });
      return data;
    },
    enabled: !!employeeId
  });
};
