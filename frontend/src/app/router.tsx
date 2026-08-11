import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <div>Dashboard (Tez kunda)</div>,
      },
      {
        path: 'expenses',
        element: <div>Xarajatlar ro'yxati (Tez kunda)</div>,
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
        element: <div>Login Formasi (Tez kunda)</div>,
      }
    ]
  },
  {
    path: '*',
    element: <div>404 sahifa topilmadi</div>
  }
]);
