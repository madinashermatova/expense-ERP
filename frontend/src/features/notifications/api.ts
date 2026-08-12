import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/notifications?isRead=false');
        return data.items || data;
      } catch (_e) {
        return [];
      }
    },
    refetchInterval: 30000 // Poll har 30 soniyada
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/mark-all-read');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });
};
