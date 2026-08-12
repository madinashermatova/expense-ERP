import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Paginated, BranchView, CategoryView, EmployeeView } from '@/lib/api/types';

export interface ExpenseListParams {
  page: number;
  limit: number;
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

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<BranchView>>(ENDPOINTS.BRANCHES);
      return response.data.items;
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
      
      const finalRes = await apiClient.post(ENDPOINTS.EXPENSE_SUBMIT(expenseId));
      return finalRes.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

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
    }
  });
};
