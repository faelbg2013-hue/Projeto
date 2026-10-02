import type { BusinessHours, BusinessHoursDay, TenantSettingValues } from '@ravion/types';

export const businessDays = [
  { id: 'monday', label: 'Segunda-feira' },
  { id: 'tuesday', label: 'Terça-feira' },
  { id: 'wednesday', label: 'Quarta-feira' },
  { id: 'thursday', label: 'Quinta-feira' },
  { id: 'friday', label: 'Sexta-feira' },
  { id: 'saturday', label: 'Sábado' },
  { id: 'sunday', label: 'Domingo' },
] as const;

export type BusinessDayId = (typeof businessDays)[number]['id'];

export interface BusinessHoursDraftDay {
  enabled: boolean;
  open: string;
  close: string;
}

export type BusinessHoursDraft = Record<BusinessDayId, BusinessHoursDraftDay>;

export function defaultBusinessHoursDraft(): BusinessHoursDraft {
  const weekday = { enabled: true, open: '08:00', close: '18:00' };
  return {
    monday: { ...weekday },
    tuesday: { ...weekday },
    wednesday: { ...weekday },
    thursday: { ...weekday },
    friday: { ...weekday },
    saturday: { enabled: true, open: '08:00', close: '12:00' },
    sunday: { enabled: false, open: '08:00', close: '18:00' },
  };
}

export function draftFromSettings(settings: TenantSettingValues): BusinessHoursDraft {
  const draft = defaultBusinessHoursDraft();
  const saved = settings.business_hours;
  if (!saved) {
    return draft;
  }

  for (const day of businessDays) {
    const value = saved[day.id];
    draft[day.id] = {
      enabled: value.enabled,
      open: value.open ?? draft[day.id].open,
      close: value.close ?? draft[day.id].close,
    };
  }
  return draft;
}

export function payloadFromDraft(draft: BusinessHoursDraft): BusinessHours {
  const hours = {} as BusinessHours;
  for (const day of businessDays) {
    hours[day.id] = toDay(draft[day.id]);
  }
  return hours;
}

function toDay(day: BusinessHoursDraftDay): BusinessHoursDay {
  if (!day.enabled) {
    return { enabled: false, open: null, close: null };
  }
  return { enabled: true, open: day.open, close: day.close };
}
