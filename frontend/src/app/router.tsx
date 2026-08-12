import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { ExpenseCreatePage } from '@/features/expenses/ExpenseCreatePage';
import { ApprovalsPage } from '@/features/approvals/ApprovalsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { RefundsPage } from '@/features/refunds/RefundsPage';
import { EditRequestsPage } from '@/features/edit-requests/EditRequestsPage';

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
        path: 'settings',
        element: <SettingsPage />,
      },
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
