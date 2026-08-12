import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { ExpenseCreatePage } from '@/features/expenses/ExpenseCreatePage';
import { ExpenseDetailsPage } from '@/features/expenses/ExpenseDetailsPage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { RefundsPage } from '@/features/refunds/RefundsPage';
import { EditRequestsPage } from '@/features/edit-requests/EditRequestsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { ExportHistoryPage } from '@/features/exports/ExportHistoryPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { BranchesPage } from '@/features/branches/BranchesPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { RequireAuth } from '@/components/shared/RequireAuth';
import { RequireRole } from '@/components/shared/RequireRole';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
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
        path: 'expenses/:id',
        element: <ExpenseDetailsPage />,
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
        path: 'reports',
        element: <ReportsPage />,
      },
      {
        path: 'audit',
        element: (
          <RequireRole roles={['ADMIN']}>
            <AuditPage />
          </RequireRole>
        ),
      },
      {
        path: 'exports',
        element: <ExportHistoryPage />,
      },
      {
        path: 'settings',
        element: (
          <RequireRole roles={['ADMIN']}>
            <SettingsPage />
          </RequireRole>
        ),
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'branches',
        element: (
          <RequireRole roles={['ADMIN']}>
            <BranchesPage />
          </RequireRole>
        ),
      },
      {
        path: 'categories',
        element: (
          <RequireRole roles={['ADMIN']}>
            <CategoriesPage />
          </RequireRole>
        ),
      },
      {
        path: 'employees',
        element: (
          <RequireRole roles={['ADMIN', 'DIRECTOR']}>
            <EmployeesPage />
          </RequireRole>
        ),
      }
      // ... boshqa modullar shu yerda qo'shiladi
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
    element: <div>404 sahifa topilmadi</div>
  }
]);
