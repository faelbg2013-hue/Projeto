import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { RootLayout } from '../layouts/RootLayout';
import { AccountPage } from '../pages/AccountPage';
import { AdminClientsPage } from '../pages/AdminClientsPage';
import { AdminProfessionalsPage } from '../pages/AdminProfessionalsPage';
import { AdminServicesPage } from '../pages/AdminServicesPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProfessionalPage } from '../pages/ProfessionalPage';
import { RegisterPage } from '../pages/RegisterPage';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'conta', element: <AccountPage /> },
          {
            element: <RequireRole roles={['PROFESSIONAL']} />,
            children: [{ path: 'profissional', element: <ProfessionalPage /> }],
          },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: 'admin/services', element: <AdminServicesPage /> },
              { path: 'admin/professionals', element: <AdminProfessionalsPage /> },
              { path: 'admin/clients', element: <AdminClientsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
