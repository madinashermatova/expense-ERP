import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Category, CategoryFormData, UpdateCategoryFormData } from './schema';

export const useCategories = (status: 'active' | 'archived' | 'all' = 'active') => {
  return useQuery<Category[]>({
    queryKey: ['categories', status],
    queryFn: async () => {
      const { data } = await apiClient.get('/categories', { params: { status } });
      return data;
    },
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiClient.post('/categories', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCategoryFormData }) => {
      const response = await apiClient.patch(`/categories/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
