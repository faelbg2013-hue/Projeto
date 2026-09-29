import type {
  ClientPointsSummary,
  Paginated,
  PointsAdjustmentResult,
  PointsBalance,
  PointsTransactionItem,
  PointsTransactionType,
} from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

const client = new ApiClient(env.apiUrl);

export const pointsService = {
  mine(): Promise<PointsBalance> {
    return client.get('/api/v1/points/me');
  },
  mineTransactions(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<PointsTransactionItem>> {
    return client.get(withQuery('/api/v1/points/me/transactions', query));
  },
  clientSummary(clientId: string): Promise<ClientPointsSummary> {
    return client.get(`/api/v1/clients/${clientId}/points`);
  },
  clientTransactions(
    clientId: string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<PointsTransactionItem>> {
    return client.get(withQuery(`/api/v1/clients/${clientId}/points/transactions`, query));
  },
  adjust(
    clientId: string,
    input: { type: 'ADJUSTMENT_CREDIT' | 'ADJUSTMENT_DEBIT'; points: number; reason: string },
  ): Promise<PointsAdjustmentResult> {
    return client.post(`/api/v1/clients/${clientId}/points/adjustments`, input);
  },
};

const creditTypes = new Set<PointsTransactionType>(['EARN', 'ADJUSTMENT_CREDIT']);

export function signedPoints(type: PointsTransactionType, points: number): string {
  return `${creditTypes.has(type) ? '+' : '-'}${points}`;
}

export const pointsTypeLabel: Record<PointsTransactionType, string> = {
  EARN: 'Atendimento',
  REDEEM: 'Resgate',
  ADJUSTMENT_CREDIT: 'Crédito',
  ADJUSTMENT_DEBIT: 'Débito',
};

export function pointsDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}
