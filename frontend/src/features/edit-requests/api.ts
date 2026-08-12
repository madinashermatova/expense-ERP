import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useEditRequests = (status?: string) => {
  return useQuery({
    queryKey: ['edit-requests', status],
    queryFn: async () => {
      const { data } = await apiClient.get('/edit-requests', { params: { status } });
      return data;
    }
  });
};

export const useApplyEditRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/edit-requests/${id}/apply`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useRejectEditRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data } = await apiClient.post(`/edit-requests/${id}/reject`, { reason });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edit-requests'] });
    }
  });
};
