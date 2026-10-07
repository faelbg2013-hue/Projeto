import { createBrowserRouter, type RouteObject } from 'react-router';
import { RequireAuth } from '../auth/RequireAuth';
import { RequireRole } from '../auth/RequireRole';
import { RootLayout } from '../layouts/RootLayout';
import { AccountPage } from '../pages/AccountPage';
import { AdminAppointmentsPage } from '../pages/AdminAppointmentsPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminClientPointsPage } from '../pages/AdminClientPointsPage';
import { AgendaPage } from '../pages/AgendaPage';
import { ProfessionalAgendaPage } from '../pages/ProfessionalAgendaPage';
import { AdminClientDetailPage } from '../pages/AdminClientDetailPage';
import { AdminClientsPage } from '../pages/AdminClientsPage';
import { AdminProfessionalDetailPage } from '../pages/AdminProfessionalDetailPage';
import { AdminProfessionalsPage } from '../pages/AdminProfessionalsPage';
import { AdminServicesPage } from '../pages/AdminServicesPage';
import { AdminSettingsPage } from '../pages/AdminSettingsPage';
import { BookingPage } from '../pages/BookingPage';
import { ClientDashboardPage } from '../pages/ClientDashboardPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { MyAppointmentsPage } from '../pages/MyAppointmentsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PointsPage } from '../pages/PointsPage';
import { ProfessionalAppointmentsPage } from '../pages/ProfessionalAppointmentsPage';
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
              { path: 'admin/professionals/:professionalId', element: <AdminProfessionalDetailPage /> },
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
