export const e2eApiOrigin = 'http://127.0.0.1:43121';
export const e2eWebOrigin = 'http://127.0.0.1:43120';
export const e2eTenantSlug = 'e2e';
export const e2eOtherTenantSlug = 'e2e-other';
export const e2eAdminEmail = 'admin@e2e.ravion.test';
export const e2eAdminPassword = 'e2e-admin-senha-local';
export const e2eOtherAdminEmail = 'admin@e2e-other.ravion.test';
export const e2eOtherAdminPassword = 'e2e-other-senha-local';
export const e2eOtherServiceName = 'Servico exclusivo e2e-other';

export function e2eDatabaseUrl(): string {
  return 'mysql://ravion_e2e:ravion_e2e_local_only@127.0.0.1:33116/ravion_e2e';
}
