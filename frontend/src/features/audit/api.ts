import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useAuditLogs = (search?: string) => {
  return useQuery({
    queryKey: ['audit', search],
    queryFn: async () => {
      const { data } = await apiClient.get('/audit', { params: { search } });
      return data.items;
    }
  });
};
