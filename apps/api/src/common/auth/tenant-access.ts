import { NotFoundException } from '@nestjs/common';

export function denyCrossTenant(actorTenantId: string, resourceTenantId: string): void {
  if (actorTenantId !== resourceTenantId) {
    throw new NotFoundException('Recurso não encontrado');
  }
}
