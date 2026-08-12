import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { ExportJobView, Paginated } from '@/lib/api/types';

export const useExports = () => {
  return useQuery({
    queryKey: ['exports'],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<ExportJobView>>(ENDPOINTS.EXPORTS);
      return data.items;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (Array.isArray(data) && data.some(d => d.status === 'QUEUED' || d.status === 'RUNNING')) {
        return 3000; // Poll every 3s if any is running/queued
      }
      return false;
    }
  });
};

export const useRequestExport = () => {
  return useMutation({
    mutationFn: async (payload: { type: string; format: string; filters: any }) => {
      const { data } = await apiClient.post(ENDPOINTS.EXPORTS, payload);
      return data;
    }
  });
};
