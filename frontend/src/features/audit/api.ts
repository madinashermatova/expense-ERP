import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { AuditEntryView, AuditFacets, Paginated } from '@/lib/api/types';
import { AuditQueryParams } from './schema';

// GET /api/audit (paginated, ADMIN only)
export const useAuditLogs = (params: AuditQueryParams = {}) => {
  return useQuery<Paginated<AuditEntryView>>({
    queryKey: ['audit', params],
    queryFn: async () => {
      const { data } = await apiClient.get<Paginated<AuditEntryView>>(ENDPOINTS.AUDIT, { params });
      return data;
    },
  });
};

// GET /api/audit/facets — distinct action/entityType values for filter dropdowns
export const useAuditFacets = () => {
  return useQuery<AuditFacets>({
    queryKey: ['audit', 'facets'],
    queryFn: async () => {
      const { data } = await apiClient.get<AuditFacets>(`${ENDPOINTS.AUDIT}/facets`);
      return data;
    },
  });
};
