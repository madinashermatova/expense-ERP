import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useAuditLogs = () => {
  return useQuery({
    queryKey: ['audit'],
    queryFn: async () => {
      const { data } = await apiClient.get('/audit');
      return data.items || data;
    }
  });
};
