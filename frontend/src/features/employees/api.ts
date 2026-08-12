import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Employee, EmployeeFormData, UpdateEmployeeFormData } from './schema';

export const useEmployees = (params: any) => {
  return useQuery<{ items: Employee[], total: number }>({
    queryKey: ['employees', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/employees', { params });
      return data;
    },
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      const response = await apiClient.post('/employees', data);
      return response.data; // { employee, tempPassword }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeFormData }) => {
      const response = await apiClient.patch(`/employees/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};

export const useResetEmployeePassword = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/employees/${id}/reset-password`);
      return response.data; // { tempPassword }
    },
  });
};

export const useTransferEmployee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, toBranchId }: { id: string; toBranchId: string }) => {
      const response = await apiClient.post(`/employees/${id}/transfer`, { toBranchId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
};
