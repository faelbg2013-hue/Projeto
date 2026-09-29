import type {
  Availability,
  Paginated,
  ProfessionalSchedule,
  ScheduleException,
  TimeBlock,
} from '@ravion/types';
import { env } from '../lib/env';
import { ApiClient } from './api';
import { withQuery } from './query';

export interface ScheduleIntervalInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeBlockInput {
  startAt: string;
  endAt: string;
  reason?: string | null;
}

export interface ScheduleExceptionInput {
  date: string;
  type: 'BLOCK' | 'OPEN';
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

const client = new ApiClient(env.apiUrl);

function base(professionalId: 'me' | string): string {
  return professionalId === 'me'
    ? '/api/v1/professionals/me'
    : `/api/v1/professionals/${professionalId}`;
}

export const scheduleService = {
  getSchedule(professionalId: 'me' | string): Promise<ProfessionalSchedule> {
    return client.get(`${base(professionalId)}/schedule`);
  },
  replaceSchedule(
    professionalId: 'me' | string,
    intervals: ScheduleIntervalInput[],
  ): Promise<ProfessionalSchedule> {
    return client.put(`${base(professionalId)}/schedule`, { intervals });
  },
  listBlocks(
    professionalId: 'me' | string,
    query: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<TimeBlock>> {
    return client.get(withQuery(`${base(professionalId)}/time-blocks`, query));
  },
  createBlock(professionalId: 'me' | string, input: TimeBlockInput): Promise<TimeBlock> {
    return client.post(`${base(professionalId)}/time-blocks`, input);
  },
  deleteBlock(professionalId: 'me' | string, blockId: string): Promise<void> {
    return client.delete(`${base(professionalId)}/time-blocks/${blockId}`);
  },
  listExceptions(professionalId: 'me' | string): Promise<Paginated<ScheduleException>> {
    return client.get(`${base(professionalId)}/exceptions`);
  },
  createException(
    professionalId: 'me' | string,
    input: ScheduleExceptionInput,
  ): Promise<ScheduleException> {
    return client.post(`${base(professionalId)}/exceptions`, input);
  },
  deleteException(professionalId: 'me' | string, exceptionId: string): Promise<void> {
    return client.delete(`${base(professionalId)}/exceptions/${exceptionId}`);
  },
  availability(professionalId: string, date: string, serviceId: string): Promise<Availability> {
    return client.get(
      withQuery(`/api/v1/professionals/${professionalId}/availability`, { date, serviceId }),
    );
  },
};
