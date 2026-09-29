import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { PasswordService } from '../apps/api/src/common/auth/password.service';

loadDotenv({ path: resolve(__dirname, '../.env') });

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const tenantId = readEnv('ADMIN_TENANT_ID');
  const tenantName = readEnv('TENANT_NAME');
  const tenantSlug = readEnv('TENANT_SLUG');
  const adminName = readEnv('ADMIN_NAME');
  const adminEmail = readEnv('ADMIN_EMAIL').toLowerCase();
  const adminPassword = readEnv('ADMIN_PASSWORD');

  if (adminPassword.length < 12) {
    throw new Error('ADMIN_PASSWORD precisa ter pelo menos 12 caracteres.');
  }

  const prisma = new PrismaClient();
  const passwords = new PasswordService();

  try {
    const existingBySlug = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (existingBySlug && existingBySlug.id !== tenantId) {
      throw new Error(
        'TENANT_SLUG já existe com um id diferente de ADMIN_TENANT_ID. O seed não cria outro tenant.',
      );
    }

    const tenant = existingBySlug
      ? await prisma.tenant.update({
          where: { id: existingBySlug.id },
          data: { name: tenantName },
        })
      : await prisma.tenant.upsert({
          where: { id: tenantId },
          update: { name: tenantName, slug: tenantSlug },
          create: {
            id: tenantId,
            name: tenantName,
            slug: tenantSlug,
            isActive: true,
          },
        });

    const existingAdmin = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: adminEmail } },
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: adminName,
          email: adminEmail,
          passwordHash: await passwords.hash(adminPassword),
          role: 'ADMIN',
          isActive: true,
        },
      });
    }

    console.log(`Tenant pronto: ${tenant.slug}`);
    console.log('Administrador pronto');
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha no seed';
  console.error(message);
  process.exit(1);
});
