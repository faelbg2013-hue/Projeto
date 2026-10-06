/**
 * Chaves que o contrato HTTP pode ler e gravar.
 * Uma chave nova é um campo validado aqui e no DTO, não uma coluna nova.
 */
export const TENANT_SETTING_KEYS = [
  'business_hours',
  'booking_min_advance_minutes',
  'cancellation_min_advance_minutes',
  'appointment_buffer_minutes',
] as const;

export type TenantSettingKey = (typeof TENANT_SETTING_KEYS)[number];
