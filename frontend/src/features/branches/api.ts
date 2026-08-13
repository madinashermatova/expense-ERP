import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Paginated } from '@/lib/api/types';
import { Branch, BranchFormData, UpdateBranchFormData, BranchQueryParams } from './schema';
import toast from 'react-hot-toast';

// 1. GET /api/branches (paginated)
export const useBranches = (params: BranchQueryParams = {}) => {
  return useQuery<Paginated<Branch>>({
    queryKey: ['branches', params],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<Branch>>('/branches', { params });
      return response.data;
    },
  });
};

// Convenient hook for dropdown lists returning Branch[]
export const useBranchList = (status: 'active' | 'archived' | 'all' = 'active') => {
  return useQuery<Branch[]>({
    queryKey: ['branches', 'list', status],
    queryFn: async () => {
      const response = await apiClient.get<Paginated<Branch>>('/branches', {
        params: { status, limit: 200 },
      });
      return response.data.items || [];
    },
  });
};

// 2. GET /api/branches/:id
export const useBranch = (id: string) => {
  return useQuery<Branch>({
    queryKey: ['branches', id],
    queryFn: async () => {
      const response = await apiClient.get<Branch>(`/branches/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

// 3. POST /api/branches
export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: BranchFormData) => {
      const response = await apiClient.post<Branch>('/branches', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" filiali muvaffaqiyatli yaratildi`);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

// 4. PATCH /api/branches/:id
export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateBranchFormData }) => {
      const response = await apiClient.patch<Branch>(`/branches/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" filiali ma'lumotlari yangilandi`);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

// 5. POST /api/branches/:id/archive
export const useArchiveBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<Branch>(`/branches/${id}/archive`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" filiali arxivlandi`);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};

// 6. POST /api/branches/:id/restore
export const useRestoreBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post<Branch>(`/branches/${id}/restore`);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" filiali qayta tiklandi`);
      queryClient.invalidateQueries({ queryKey: ['branches'] });
    },
  });
};
