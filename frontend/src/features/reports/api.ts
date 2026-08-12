import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

export interface ReportParams {
  type: string;
  startDate?: string;
  endDate?: string;
  period?: string;
}

export const useReports = (params: ReportParams) => {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: async () => {
      let endpoint = '';
      switch (params.type) {
        case 'BRANCH':
          endpoint = ENDPOINTS.REPORTS_BY_BRANCH;
          break;
        case 'CATEGORY':
          endpoint = ENDPOINTS.REPORTS_BY_CATEGORY;
          break;
        case 'EMPLOYEE':
          endpoint = ENDPOINTS.REPORTS_BY_EMPLOYEE;
          break;
        case 'BUDGET':
          endpoint = ENDPOINTS.REPORTS_BUDGET;
          break;
        default:
          endpoint = ENDPOINTS.REPORTS_BY_BRANCH;
      }
      
      const { type: _type, ...restParams } = params;
      const { data } = await apiClient.get(endpoint, { params: restParams });
      return data;
    }
  });
};
