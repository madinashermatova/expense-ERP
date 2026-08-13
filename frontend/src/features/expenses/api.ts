import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Paginated, BranchView, CategoryView, EmployeeView, BulkApproveResult } from '@/lib/api/types';

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  categoryId?: string;
  employeeId?: string;
  status?: string | string[];
  minAmount?: number;
  maxAmount?: number;
  paymentMethod?: string;
  currency?: string;
  q?: string;
  from?: string;
  to?: string;
}

export const useExpenses = (params: ExpenseListParams) => {
  return useQuery({
    queryKey: ['expenses', 'list', params],
    queryFn: async () => {
      const response = await apiClient.get(ENDPOINTS.EXPENSES, { params });
      return response.data;
    }
  });
};

export const useBranches = (status: string = 'active') => {
  return useQuery({
    queryKey: ['branches', status],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<BranchView>>(ENDPOINTS.BRANCHES, { params: { status } });
      return response.data.items || response.data;
    }
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await apiClient.get<CategoryView[]>(ENDPOINTS.CATEGORIES);
      return response.data;
    }
  });
};

export const useEmployees = (branchId?: string) => {
  return useQuery({
    queryKey: ['employees', branchId],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<EmployeeView>>(ENDPOINTS.EMPLOYEES, { params: { branchId, status: 'ACTIVE' } });
      return response.data.items;
    },
    enabled: branchId !== undefined ? !!branchId : true
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, files }: { data: any, files: File[] }) => {
      const expenseRes = await apiClient.post(ENDPOINTS.EXPENSES, data);
      const expenseId = expenseRes.data.id;
      
      if (files && files.length > 0) {
        const formData = new FormData();
        files.forEach(f => {
          formData.append('files', f);
        });
        await apiClient.post(ENDPOINTS.EXPENSE_FILES(expenseId), formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // POST /expenses already lands non-receipt categories in DIRECTOR_PENDING/ADMIN_PENDING;
      // only DRAFT (receipt-required categories awaiting file upload) needs an explicit submit.
      if (expenseRes.data.status === 'DRAFT') {
        const finalRes = await apiClient.post(ENDPOINTS.EXPENSE_SUBMIT(expenseId));
        return finalRes.data;
      }
      return expenseRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    }
  });
};

export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/approve`, { version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, version }: { id: string; reason: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/reject`, { reason, version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useRequestFixExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason, version }: { id: string; reason: string; version?: number }) => {
      const response = await apiClient.post(`/expenses/${id}/request-fix`, { reason, version });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useBulkApproveExpenses = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiClient.post<BulkApproveResult>('/expenses/bulk-approve', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

export const useCreateExport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { type: string; format: 'xlsx' | 'pdf'; filters: any }) => {
      const response = await apiClient.post('/exports', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exports'] });
    }
  });
};

export const useExpenseAction = (id: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, reason, version }: { action: 'approve' | 'reject' | 'request-fix' | 'cancel' | 'submit', reason?: string, version?: number }) => {
      const body: { reason?: string; version?: number } = {};
      if (action === 'reject' || action === 'request-fix') body.reason = reason;
      if (action === 'approve' || action === 'reject' || action === 'request-fix') body.version = version;
      const res = await apiClient.post(`/expenses/${id}/${action}`, body);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};
