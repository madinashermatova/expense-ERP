import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { NotificationView, Paginated } from '@/lib/api/types';

export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<NotificationView>>(ENDPOINTS.NOTIFICATIONS, {
        params: { isRead: false }
      });
      return data.items;
    },
    refetchInterval: 30000 // Poll har 30 soniyada
  });
};

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post(`${ENDPOINTS.NOTIFICATIONS}/mark-all-read`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  });
};
