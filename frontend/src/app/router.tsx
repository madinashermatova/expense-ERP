import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';

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
