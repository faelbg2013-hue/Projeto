import { Prisma, type PrismaClient } from '@prisma/client';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export class BootstrapConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapConflict';
  }
}

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
}

export interface BootstrapInput {
  tenantName: string;
  tenantSlug: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface BootstrapResult {
  tenantId: string;
  adminId: string;
  created: true;
}

type BootstrapClient = Pick<PrismaClient, '$transaction'>;

export function assertBootstrapPassword(password: string): void {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    throw new Error(
      `A senha do administrador precisa ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.`,
    );
  }
}

export function normalizeBootstrapInput(input: BootstrapInput): BootstrapInput {
  const tenantName = input.tenantName.trim();
  const tenantSlug = input.tenantSlug.trim().toLowerCase();
  const adminName = input.adminName.trim();
  const adminEmail = input.adminEmail.trim().toLowerCase();

  if (tenantName.length < 1 || tenantName.length > 120) {
    throw new Error('O nome do tenant precisa ter entre 1 e 120 caracteres.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tenantSlug) || tenantSlug.length > 80) {
    throw new Error('O slug do tenant precisa usar letras minúsculas, números e hífens.');
  }
  if (adminName.length < 2 || adminName.length > 160) {
    throw new Error('O nome do administrador precisa ter entre 2 e 160 caracteres.');
  }
  if (adminEmail.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error('O e-mail do administrador é inválido.');
  }
  assertBootstrapPassword(input.password);

  return {
    tenantName,
    tenantSlug,
    adminName,
    adminEmail,
    password: input.password,
  };
}

export async function bootstrapFirstAdmin(
  prisma: BootstrapClient,
  passwords: PasswordHasher,
  rawInput: BootstrapInput,
): Promise<BootstrapResult> {
  const input = normalizeBootstrapInput(rawInput);
  const passwordHash = await passwords.hash(input.password);

  try {
    return await prisma.$transaction(async (tx) => {
      const existingTenant = await tx.tenant.findUnique({ where: { slug: input.tenantSlug } });
      if (existingTenant) {
        const sameEmail = await tx.user.findUnique({
          where: {
            tenantId_email: { tenantId: existingTenant.id, email: input.adminEmail },
          },
        });
        const existingAdmin = await tx.user.findFirst({
          where: { tenantId: existingTenant.id, role: 'ADMIN' },
          select: { id: true },
        });
        if (sameEmail || existingAdmin) {
          throw new BootstrapConflict(
            'O provisionamento já existe. Nenhuma credencial foi alterada.',
          );
        }
        throw new BootstrapConflict(
          'O tenant já existe. O bootstrap não cria outro administrador.',
        );
      }

      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
          isActive: true,
        },
      });
      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.adminName,
          email: input.adminEmail,
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });
      return { tenantId: tenant.id, adminId: admin.id, created: true as const };
    });
  } catch (error) {
    if (error instanceof BootstrapConflict) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BootstrapConflict('O provisionamento já existe. Nenhuma credencial foi alterada.');
    }
    throw error;
  }
}
