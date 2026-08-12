import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { RateView } from '@/lib/api/types';

export const useCurrencies = () => {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: async () => {
      const response = await apiClient.get<RateView[]>(ENDPOINTS.CURRENCY_RATES);
      return response.data;
    }
  });
};

export const useCreateCurrency = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post(ENDPOINTS.CURRENCY_RATES, data);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['currencies'] })
  });
};
