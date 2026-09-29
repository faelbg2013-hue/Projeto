import { NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { denyCrossTenant } from './tenant-access';

describe('TenantContext', () => {
  it('allows an operation inside the authenticated tenant', () => {
    expect(() => denyCrossTenant('tenant-a', 'tenant-a')).not.toThrow();
  });

  it('hides a record that belongs to another tenant', () => {
    expect(() => denyCrossTenant('tenant-a', 'tenant-b')).toThrow(NotFoundException);
    expect(() => denyCrossTenant('tenant-a', 'tenant-b')).toThrow('Recurso não encontrado');
  });
});
