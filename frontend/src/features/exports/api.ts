import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useExports = () => {
  return useQuery({
    queryKey: ['exports'],
    queryFn: async () => {
      // Mocking for now as it's not ready in real backend yet
      try {
        const { data } = await apiClient.get('/exports');
        return data.items || data;
      } catch (e) {
        return [
          { id: '1', type: 'E2', format: 'Excel', status: 'DONE', rowCount: 1500, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() },
          { id: '2', type: 'E9', format: 'PDF', status: 'QUEUED', rowCount: null, createdAt: new Date().toISOString(), expiresAt: null }
        ];
      }
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
      const { data } = await apiClient.post('/exports', payload);
      return data;
    }
  });
};
