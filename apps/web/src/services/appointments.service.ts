import type { AppointmentItem, AppointmentStatus, Paginated } from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface CreateAppointmentInput {
  professionalId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string | null;
  bookingMode?: 'NORMAL' | 'POINTS';
}

export interface AppointmentListQuery {
  page?: number;
  pageSize?: number;
  view?: 'upcoming' | 'history';
  date?: string;
  status?: AppointmentStatus;
  professionalId?: string;
  clientId?: string;
  serviceId?: string;
  startDate?: string;
  endDate?: string;
}

const client = new ApiClient(env.apiUrl);

export const appointmentsService = {
  create(input: CreateAppointmentInput, idempotencyKey: string): Promise<AppointmentItem> {
    return client.post('/api/v1/appointments', input, { 'Idempotency-Key': idempotencyKey });
  },
  mine(query: AppointmentListQuery = {}): Promise<Paginated<AppointmentItem>> {
    return client.get(withQuery('/api/v1/appointments/me', query));
  },
  list(query: AppointmentListQuery = {}): Promise<Paginated<AppointmentItem>> {
    return client.get(withQuery('/api/v1/appointments', query));
  },
  professional(query: AppointmentListQuery = {}): Promise<Paginated<AppointmentItem>> {
    return client.get(withQuery('/api/v1/professionals/me/appointments', query));
  },
  cancel(id: string): Promise<AppointmentItem> {
    return client.patch(`/api/v1/appointments/${id}/cancel`);
  },
  complete(id: string): Promise<AppointmentItem> {
    return client.patch(`/api/v1/appointments/${id}/complete`);
  },
  noShow(id: string): Promise<AppointmentItem> {
    return client.patch(`/api/v1/appointments/${id}/no-show`);
  },
};

export function money(value: string): string {
  const [whole, cents = '00'] = value.split('.');
  return `R$ ${whole},${cents}`;
}

export function civilDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

export const appointmentStatusLabel: Record<AppointmentStatus, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
};
