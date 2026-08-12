import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/store';
import toast from 'react-hot-toast';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  withCredentials: true,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = 'Bearer ' + token;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = response.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = 'Bearer ' + newAccessToken;
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        useAuthStore.getState().clearAuth();
        // optionally redirect to login
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const status = error.response?.status;
    const errData = error.response?.data as any;
    
    // Toast global errors if no details provided (except special codes handled by forms)
    if (status && status !== 401) {
      if (errData && !errData.details) {
        if (errData.code === 'PLAN_LIMIT_EXCEEDED') {
          // Can be handled globally with a special event or just toast for now
          toast.error(errData.message || 'Tarif limiti tugadi');
        } else if (status === 409 && errData.code === 'EXPENSE_ALREADY_PROCESSED') {
          toast.error('Bu ariza allaqachon qayta ishlangan');
        } else if (status === 429) {
          // Handled mostly by forms, but we can show a global toast if not login
          if (!originalRequest.url?.includes('/auth/login')) {
            toast.error("Ko'p so'rov yuborildi, iltimos kuting");
          }
        } else if (status === 403 && errData.code !== 'WEB_ACCESS_DENIED' && errData.code !== 'ACCOUNT_INACTIVE' && errData.code !== 'COMPANY_SUSPENDED') {
          toast.error(errData.message || 'Kirish taqiqlangan');
        } else if (status >= 500) {
          toast.error('Server xatosi yuz berdi');
        } else {
          // Generic fallback for other statuses like 400, 404 without details
          if (!originalRequest.url?.includes('/auth/login')) {
             toast.error(errData.message || 'Xatolik yuz berdi');
          }
        }
      }
    }

    return Promise.reject(error);
  }
);
