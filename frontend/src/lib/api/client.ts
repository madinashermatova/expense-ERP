import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/store';
import { handleMockRequest } from '@/lib/api/mockInterceptor';
import i18n from '@/i18n';
import toast from 'react-hot-toast';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://erp-api-l99l.onrender.com/api',
  withCredentials: true,
});

// Custom adapter / request interceptor to inject Authorization and x-lang headers
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (config.headers) {
    const currentLang = i18n.language || 'uz';
    config.headers['x-lang'] = currentLang.toLowerCase().startsWith('ru') ? 'ru' : 'uz';
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
    // If backend network fails, fallback gracefully to mock handler
    if (!error.response && error.config) {
      const mockResponse = await handleMockRequest(error.config);
      if (mockResponse) {
        return mockResponse;
      }
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry if the 401 came from login or refresh itself
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

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

      const currentLang = i18n.language || 'uz';
      const langHeader = currentLang.toLowerCase().startsWith('ru') ? 'ru' : 'uz';

      try {
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'https://erp-api-l99l.onrender.com/api'}/auth/refresh`,
          {},
          { 
            withCredentials: true,
            headers: { 'x-lang': langHeader }
          }
        );

        const newAccessToken = response.data.accessToken;
        const newUser = response.data.user;
        useAuthStore.getState().setAccessToken(newAccessToken);
        if (newUser) {
          useAuthStore.getState().setUser(newUser);
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = 'Bearer ' + newAccessToken;
        }

        processQueue(null, newAccessToken);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const status = error.response?.status;
    const errData = error.response?.data as any;

    /*
     * Xabar matni serverdan keladi va so'rov tilida bo'ladi (`x-lang`), shuning uchun
     * bu yerda matn yozilmaydi — faqat tarmoq darajasidagi holatlar uchun zaxira.
     */
    const fallback = (key: string) => i18n.t(`errors.${key}`, { ns: 'common' });

    if (!error.response) {
      toast.error(fallback('network'));
    } else if (status && status !== 401 && errData && !errData.details) {
      const isLogin = originalRequest.url?.includes('/auth/login');
      const silentCodes = [
        'WEB_ACCESS_DENIED',
        'ACCOUNT_INACTIVE',
        'COMPANY_SUSPENDED',
        'MULTIPLE_COMPANIES',
        'PLAN_LIMIT_EXCEEDED',
        'EDIT_WINDOW_CLOSED',
        'ALREADY_PROCESSED'
      ];

      if (status >= 500) {
        toast.error(errData.message || fallback('server'));
      } else if (status === 429) {
        if (!isLogin) toast.error(errData.message || fallback('tooManyRequests'));
      } else if (errData.code === 'ALREADY_PROCESSED') {
        toast.error(errData.message || fallback('generic'));
      } else if (errData.code === 'PLAN_LIMIT_EXCEEDED') {
        toast.error(errData.message || fallback('generic'));
      } else if (!silentCodes.includes(errData.code) && !isLogin) {
        toast.error(errData.message || fallback('generic'));
      }
    }

    return Promise.reject(error);
  }
);
