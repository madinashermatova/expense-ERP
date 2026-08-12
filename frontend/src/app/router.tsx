import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { ExpenseCreatePage } from '@/features/expenses/ExpenseCreatePage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { RefundsPage } from '@/features/refunds/RefundsPage';
import { EditRequestsPage } from '@/features/edit-requests/EditRequestsPage';
import { BranchesPage } from '@/features/branches/BranchesPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { BudgetsPage } from '@/features/budgets/BudgetsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { CurrencyPage } from '@/features/currency/CurrencyPage';
import { UsersPage } from '@/features/users/UsersPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { ExportHistoryPage } from '@/features/exports/ExportHistoryPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'expenses',
        element: <ExpensesPage />,
      },
      {
        path: 'expenses/create',
        element: <ExpenseCreatePage />,
      },
      {
        path: 'approvals',
        element: <ApprovalsPage />,
      },
      {
        path: 'refunds',
        element: <RefundsPage />,
      },
      {
        path: 'edit-requests',
        element: <EditRequestsPage />,
      },
      {
        path: 'branches',
        element: <BranchesPage />,
      },
      {
        path: 'employees',
        element: <EmployeesPage />,
      },
      {
        path: 'categories',
        element: <CategoriesPage />,
      },
      {
        path: 'budgets',
        element: <BudgetsPage />,
      },
      {
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'currency',
        element: <CurrencyPage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
      {
        path: 'audit',
        element: <AuditPage />,
      },
      {
        path: 'exports',
        element: <ExportHistoryPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      }
    ],
  },
  {
    path: '/login',
    element: <AuthLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      }
    ]
  },
  {
    path: '*',
    element: (
      <div style={{
        minHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '16px'
      }}>
        <h1 style={{ fontSize: '72px', fontWeight: 800, color: 'rgb(var(--primary))', margin: 0 }}>404</h1>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Sahifa topilmadi</h2>
        <p style={{ color: 'rgb(var(--muted-foreground))' }}>Siz qidirayotgan sahifa mavjud emas yoki ko'chirilgan.</p>
        <a href="/" style={{ textDecoration: 'none' }}>
          <button style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: 'rgb(var(--primary))',
            color: 'white',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            Bosh sahifaga qaytish
          </button>
        </a>
      </div>
    )
  }
]);
