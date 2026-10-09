import { Prisma, PrismaClient } from '@prisma/client';
import { PasswordService } from '../apps/api/src/common/auth/password.service';
import { assertE2eStack } from '../apps/api/src/config/e2e-stack';
import {
  e2eAdminEmail,
  e2eAdminPassword,
  e2eDatabaseUrl,
  e2eOtherAdminEmail,
  e2eOtherAdminPassword,
  e2eOtherServiceName,
  e2eOtherTenantSlug,
  e2eTenantSlug,
} from '../apps/web/e2e/target';

const primaryTenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const otherServiceId = '33333333-3333-4333-8333-333333333333';

process.env.E2E_STACK = 'ravion_e2e';
process.env.NODE_ENV = 'development';
process.env.PORT = '43121';
process.env.DATABASE_URL = e2eDatabaseUrl();
assertE2eStack(process.env);

const prisma = new PrismaClient({ datasources: { db: { url: e2eDatabaseUrl() } } });
const passwords = new PasswordService();

async function ensureTenant(id: string, slug: string, name: string): Promise<void> {
  await prisma.tenant.upsert({
    where: { slug },
    update: { name, isActive: true },
    create: { id, name, slug, isActive: true },
  });
}

async function ensureAdmin(tenantSlug: string, email: string, name: string, password: string): Promise<void> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: tenantSlug } });
  const passwordHash = await passwords.hash(password);
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { name, passwordHash, role: 'ADMIN', isActive: true },
    create: {
      tenantId: tenant.id,
      name,
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });
}

async function main(): Promise<void> {
  await ensureTenant(primaryTenantId, e2eTenantSlug, 'E2E Ravion');
  await ensureTenant(otherTenantId, e2eOtherTenantSlug, 'E2E Outro');
  await ensureAdmin(e2eTenantSlug, e2eAdminEmail, 'Admin E2E', e2eAdminPassword);
  await ensureAdmin(e2eOtherTenantSlug, e2eOtherAdminEmail, 'Admin E2E Outro', e2eOtherAdminPassword);
  await prisma.service.upsert({
    where: { id: otherServiceId },
    update: { name: e2eOtherServiceName, isActive: true },
    create: {
      id: otherServiceId,
      tenantId: otherTenantId,
      name: e2eOtherServiceName,
      price: new Prisma.Decimal('10.00'),
      durationMinutes: 30,
      points: 0,
      isActive: true,
    },
  });
  console.log('Fixtures E2E prontas nos tenants e2e e e2e-other.');
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Falha ao criar fixtures E2E';
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
