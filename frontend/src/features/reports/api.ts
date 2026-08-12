import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface ReportParams {
  type: string;
  startDate?: string;
  endDate?: string;
}

export const useReports = (params: ReportParams) => {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/reports', { params });
      return data;
    }
  });
};
