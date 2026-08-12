export const ENDPOINTS = {
  DASHBOARD_STATS: '/reports/summary',
  DASHBOARD_DYNAMICS: '/reports/dynamics',
  DASHBOARD_CATEGORIES: '/reports/by-category',
  DASHBOARD_BRANCHES: '/reports/by-branch',
  
  REPORTS_SUMMARY: '/reports/summary',
  REPORTS_BY_BRANCH: '/reports/by-branch',
  REPORTS_BY_CATEGORY: '/reports/by-category',
  REPORTS_BY_EMPLOYEE: '/reports/by-employee',
  REPORTS_BUDGET: '/reports/budget-vs-actual',

  CURRENCY_RATES: '/currency/rates',
  CURRENCY_RATES_CURRENT: '/currency/rates/current',
  
  EXPENSES: '/expenses',
  EXPENSE_FILES: (id: string) => `/expenses/${id}/files`,
  EXPENSE_SUBMIT: (id: string) => `/expenses/${id}/submit`,
  
  EXPORTS: '/exports',
  NOTIFICATIONS: '/notifications',
  
  BRANCHES: '/branches',
  CATEGORIES: '/categories',
  EMPLOYEES: '/employees',
  BUDGETS: '/budgets',
  REFUNDS: '/refunds',
  EDIT_REQUESTS: '/edit-requests',
  AUDIT: '/audit',
  AUTH: '/auth',
};
