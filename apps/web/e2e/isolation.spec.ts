import { expect, test, type APIRequestContext } from '@playwright/test';
import {
  e2eAdminEmail,
  e2eAdminPassword,
  e2eApiOrigin,
  e2eOtherAdminEmail,
  e2eOtherAdminPassword,
  e2eOtherServiceName,
  e2eOtherTenantSlug,
  e2eTenantSlug,
} from './target';

async function token(request: APIRequestContext, slug: string, email: string, password: string): Promise<string> {
  const response = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': slug },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

test('tenants cannot read each other through the session', async ({ request }) => {
  const wrongTenant = await request.post(`${e2eApiOrigin}/api/v1/auth/login`, {
    headers: { 'X-Tenant-Slug': e2eTenantSlug },
    data: { email: e2eOtherAdminEmail, password: e2eOtherAdminPassword },
  });
  expect(wrongTenant.status()).toBe(401);

  const primary = await token(request, e2eTenantSlug, e2eAdminEmail, e2eAdminPassword);
  const other = await token(request, e2eOtherTenantSlug, e2eOtherAdminEmail, e2eOtherAdminPassword);

  const primaryServices = await request.get(`${e2eApiOrigin}/api/v1/services?pageSize=100`, {
    headers: { authorization: `Bearer ${primary}` },
  });
  const otherServices = await request.get(`${e2eApiOrigin}/api/v1/services?pageSize=100`, {
    headers: { authorization: `Bearer ${other}` },
  });
  expect(primaryServices.status()).toBe(200);
  expect(otherServices.status()).toBe(200);

  const primaryBody = (await primaryServices.json()) as { data: Array<{ name: string }> };
  const otherBody = (await otherServices.json()) as { data: Array<{ name: string }> };
  expect(primaryBody.data.some((service) => service.name === e2eOtherServiceName)).toBe(false);
  expect(otherBody.data.some((service) => service.name === e2eOtherServiceName)).toBe(true);

  const updated = await request.patch(`${e2eApiOrigin}/api/v1/settings`, {
    headers: { authorization: `Bearer ${primary}` },
    data: { settings: { booking_max_advance_days: 21 } },
  });
  expect(updated.status()).toBe(200);
  const otherSettings = await request.get(`${e2eApiOrigin}/api/v1/settings`, {
    headers: { authorization: `Bearer ${other}` },
  });
  expect(otherSettings.status()).toBe(200);
  const otherSettingsBody = (await otherSettings.json()) as {
    settings: { booking_max_advance_days?: number };
  };
  expect(otherSettingsBody.settings.booking_max_advance_days ?? 0).toBe(0);

  const client = await request.post(`${e2eApiOrigin}/api/v1/auth/register`, {
    headers: { 'X-Tenant-Slug': e2eTenantSlug },
    data: {
      name: 'Cliente Isolamento',
      email: `isolamento-${Date.now()}@example.com`,
      password: 'senha-segura',
    },
  });
  expect(client.status()).toBe(201);
  const clientBody = (await client.json()) as { accessToken: string };
  const denied = await request.get(`${e2eApiOrigin}/api/v1/settings`, {
    headers: { authorization: `Bearer ${clientBody.accessToken}` },
  });
  expect(denied.status()).toBe(403);
});
