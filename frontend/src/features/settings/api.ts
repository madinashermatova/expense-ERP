import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface SettingsView {
  currencyBase: 'CBU' | 'MANUAL';
  reportPeriodStartDay: number;
  approvalReminderHours: number;
  expenseEditWindowHours: number;
  defaultLanguage: 'uz' | 'ru';
  workDays: number[];
  notificationsEnabled: boolean;
}

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await apiClient.get<SettingsView>('/settings');
      return data;
    }
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SettingsView>) => {
      const res = await apiClient.patch('/settings', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    }
  });
};
