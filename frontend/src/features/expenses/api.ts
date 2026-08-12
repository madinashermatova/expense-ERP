import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Paginated, BranchView, CategoryView, EmployeeView } from '@/lib/api/types';

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
<<<<<<< HEAD
      const response = await apiClient.get('/branches', { params: { status } });
      return response.data.items || response.data;
=======
      const response = await apiClient.get<Paginated<BranchView>>(ENDPOINTS.BRANCHES);
      return response.data.items;
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    }
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
<<<<<<< HEAD
      const response = await apiClient.get('/categories');
=======
      const response = await apiClient.get<CategoryView[]>(ENDPOINTS.CATEGORIES);
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
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

<<<<<<< HEAD
export const useApproveExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/expenses/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
=======
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
      
      const finalRes = await apiClient.post(ENDPOINTS.EXPENSE_SUBMIT(expenseId));
      return finalRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    }
  });
};

<<<<<<< HEAD
export const useRejectExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.post(`/expenses/${id}/reject`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useRequestFixExpense = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await apiClient.post(`/expenses/${id}/request-fix`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    }
  });
};

export const useBulkApproveExpenses = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiClient.post('/expenses/bulk-approve', { ids });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
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
=======
export const useExpenseAction = (id: string) => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ action, reason }: { action: 'approve' | 'reject' | 'request-fix' | 'cancel' | 'submit', reason?: string }) => {
      const res = await apiClient.post(`/expenses/${id}/${action}`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', id] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
>>>>>>> 09480eebc3624593477022b1f8609048dbaad256
    }
  });
};
