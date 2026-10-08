import { lazy, type ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { RootLayout } from '../layouts/RootLayout';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { RegisterPage } from '../pages/RegisterPage';

const routeModules: Promise<unknown>[] = [];

function lazyNamed(load: () => Promise<Record<string, unknown>>, name: string) {
  const resolve = () =>
    load().then((module) => {
      const component = module[name];
      if (typeof component !== 'function') {
        throw new Error(`Página ${name} indisponível`);
      }
      return { default: component as ComponentType<Record<string, unknown>> };
    });
  if (import.meta.env.MODE === 'test') {
    routeModules.push(resolve());
  }
  return lazy(resolve);
}

const AccountPage = lazyNamed(() => import('../pages/AccountPage'), 'AccountPage');
const AdminAppointmentsPage = lazyNamed(
  () => import('../pages/AdminAppointmentsPage'),
  'AdminAppointmentsPage',
);
const AdminDashboardPage = lazyNamed(() => import('../pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminClientPointsPage = lazyNamed(
  () => import('../pages/AdminClientPointsPage'),
  'AdminClientPointsPage',
);
const AgendaPage = lazyNamed(() => import('../pages/AgendaPage'), 'AgendaPage');
const ProfessionalAgendaPage = lazyNamed(
  () => import('../pages/ProfessionalAgendaPage'),
  'ProfessionalAgendaPage',
);
const AdminClientDetailPage = lazyNamed(
  () => import('../pages/AdminClientDetailPage'),
  'AdminClientDetailPage',
);
const AdminClientsPage = lazyNamed(() => import('../pages/AdminClientsPage'), 'AdminClientsPage');
const AdminProfessionalDetailPage = lazyNamed(
  () => import('../pages/AdminProfessionalDetailPage'),
  'AdminProfessionalDetailPage',
);
const AdminProfessionalsPage = lazyNamed(
  () => import('../pages/AdminProfessionalsPage'),
  'AdminProfessionalsPage',
);
const AdminServicesPage = lazyNamed(() => import('../pages/AdminServicesPage'), 'AdminServicesPage');
const AdminSettingsPage = lazyNamed(() => import('../pages/AdminSettingsPage'), 'AdminSettingsPage');
const BookingPage = lazyNamed(() => import('../pages/BookingPage'), 'BookingPage');
const ClientDashboardPage = lazyNamed(
  () => import('../pages/ClientDashboardPage'),
  'ClientDashboardPage',
);
const MyAppointmentsPage = lazyNamed(() => import('../pages/MyAppointmentsPage'), 'MyAppointmentsPage');
const PointsPage = lazyNamed(() => import('../pages/PointsPage'), 'PointsPage');
const ProfessionalAppointmentsPage = lazyNamed(
  () => import('../pages/ProfessionalAppointmentsPage'),
  'ProfessionalAppointmentsPage',
);
const ProfessionalPage = lazyNamed(() => import('../pages/ProfessionalPage'), 'ProfessionalPage');

if (import.meta.env.MODE === 'test') {
  await Promise.all(routeModules);
}

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
            element: <RequireRole roles={['CLIENT']} />,
            children: [
              { path: 'cliente', element: <ClientDashboardPage /> },
              { path: 'agendar', element: <BookingPage /> },
              { path: 'agendamentos', element: <MyAppointmentsPage /> },
              { path: 'pontos', element: <PointsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['PROFESSIONAL']} />,
            children: [
              { path: 'profissional', element: <ProfessionalPage /> },
              { path: 'profissional/agenda', element: <ProfessionalAgendaPage /> },
              { path: 'profissional/agenda/semana', element: <AgendaPage scope="me" /> },
              { path: 'profissional/agendamentos', element: <ProfessionalAppointmentsPage /> },
            ],
          },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: 'admin/dashboard', element: <AdminDashboardPage /> },
              { path: 'admin/services', element: <AdminServicesPage /> },
              { path: 'admin/professionals', element: <AdminProfessionalsPage /> },
              {
                path: 'admin/professionals/:professionalId',
                element: <AdminProfessionalDetailPage />,
              },
              { path: 'admin/appointments', element: <AdminAppointmentsPage /> },
              {
                path: 'admin/professionals/:professionalId/schedule',
                element: <AgendaPage scope="admin" />,
              },
              { path: 'admin/clients', element: <AdminClientsPage /> },
              { path: 'admin/clients/:clientId', element: <AdminClientDetailPage /> },
              { path: 'admin/settings', element: <AdminSettingsPage /> },
              { path: 'admin/clients/:clientId/points', element: <AdminClientPointsPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
