export type { AuditEntryView, AuditChange, AuditFacets } from '@/lib/api/types';

export interface AuditQueryParams {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  entityType?: string;
  action?: string;
  channel?: 'WEB' | 'TELEGRAM' | 'SYSTEM';
  q?: string;
  page?: number;
  limit?: number;
}
