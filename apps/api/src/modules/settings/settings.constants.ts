/**
 * Chaves que o contrato HTTP pode ler e gravar.
 * F11.1 deixa a lista vazia de propósito: horário, pontos, identidade e pagamento entram em etapas seguintes.
 * Uma chave nova é um campo validado aqui e no DTO, não uma coluna nova.
 */
export const TENANT_SETTING_KEYS = [] as const;

export type TenantSettingKey = (typeof TENANT_SETTING_KEYS)[number];
