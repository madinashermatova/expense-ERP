import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { SummaryReport, BudgetUsageView } from '@/lib/api/types';

export const useDashboardStats = (period: string) => {
  return useQuery({
    queryKey: ['dashboard', 'stats', period],
    queryFn: async () => {
      const [summaryRes, budgetRes] = await Promise.all([
        apiClient.get<SummaryReport>(ENDPOINTS.DASHBOARD_STATS, { params: { period } }),
        apiClient.get<BudgetUsageView[]>(ENDPOINTS.REPORTS_BUDGET, { params: { period } })
      ]);
      const summary = summaryRes.data;
      const budgetUsage = budgetRes.data;
      const budgetPercent = budgetUsage && budgetUsage.length > 0 ? Math.max(...budgetUsage.map(b => b.usedPercent)) : 0;
      
      return {
        totalExpense: parseFloat(summary.totalUzs || '0'),
        pending1: summary.pendingDirectorCount || 0,
        pending2: summary.pendingAdminCount || 0,
        budgetPercent: budgetPercent
      };
    }
  });
};

export const useDashboardCharts = (period: string) => {
  return useQuery({
    queryKey: ['dashboard', 'charts', period],
    queryFn: async () => {
      const [dynamicsRes, categoriesRes, branchesRes] = await Promise.all([
        apiClient.get(ENDPOINTS.DASHBOARD_DYNAMICS, { params: { period, granularity: 'month' } }),
        apiClient.get(ENDPOINTS.DASHBOARD_CATEGORIES, { params: { period } }),
        apiClient.get(ENDPOINTS.DASHBOARD_BRANCHES, { params: { period } })
      ]);
      return {
        dynamics: dynamicsRes.data,
        categories: categoriesRes.data,
        branches: branchesRes.data,
      };
    }
  });
};
