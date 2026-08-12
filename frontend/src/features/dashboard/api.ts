import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export const useDashboardStats = (period: string) => {
  return useQuery({
    queryKey: ['dashboard', 'stats', period],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/stats', { params: { period } });
      return data;
    }
  });
};

export const useDashboardCharts = (period: string) => {
  return useQuery({
    queryKey: ['dashboard', 'charts', period],
    queryFn: async () => {
      const { data } = await apiClient.get('/dashboard/charts', { params: { period } });
      return data;
    }
  });
};
