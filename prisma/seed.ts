import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { PasswordService } from '../apps/api/src/common/auth/password.service';
import { assertDevelopmentSeedAllowed } from '../apps/api/src/config/development-seed';
import {
  addDays,
  nextOrSameDate,
  parseScheduleInstant,
  todayInScheduleZone,
} from '../apps/api/src/common/time/schedule-clock';

loadDotenv({ path: resolve(__dirname, '../.env') });

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável obrigatória ausente: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  assertDevelopmentSeedAllowed(process.env.NODE_ENV);

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

    await ensureOperationalUser(prisma, passwords, {
      tenantId: tenant.id,
      name: readEnv('SEED_CLIENT_NAME'),
      email: readEnv('SEED_CLIENT_EMAIL').toLowerCase(),
      password: readEnv('SEED_CLIENT_PASSWORD'),
      role: 'CLIENT',
    });
    await ensureOperationalUser(prisma, passwords, {
      tenantId: tenant.id,
      name: readEnv('SEED_PROFESSIONAL_NAME'),
      email: readEnv('SEED_PROFESSIONAL_EMAIL').toLowerCase(),
      password: readEnv('SEED_PROFESSIONAL_PASSWORD'),
      role: 'PROFESSIONAL',
      displayName: readEnv('SEED_PROFESSIONAL_DISPLAY_NAME'),
    });
    await ensureSchedule(prisma, tenant.id, readEnv('SEED_PROFESSIONAL_EMAIL').toLowerCase());
    await backfillClientProfiles(prisma, tenant.id);
    await ensureServices(prisma, tenant.id);
    await ensureDevelopmentAppointment(
      prisma,
      tenant.id,
      readEnv('SEED_CLIENT_EMAIL').toLowerCase(),
      readEnv('SEED_PROFESSIONAL_EMAIL').toLowerCase(),
    );

    console.log(`Tenant pronto: ${tenant.slug}`);
    console.log('Administrador pronto');
    console.log('Cliente de teste pronto');
    console.log('Profissional de teste pronto');
    console.log('Serviços de desenvolvimento prontos');
    console.log('Agenda de desenvolvimento pronta');
    console.log('Agendamento de desenvolvimento pronto');
  } finally {
    await prisma.$disconnect();
  }
}

async function ensureOperationalUser(
  prisma: PrismaClient,
  passwords: PasswordService,
  input: {
    tenantId: string;
    name: string;
    email: string;
    password: string;
    role: 'CLIENT' | 'PROFESSIONAL';
    displayName?: string;
  },
): Promise<void> {
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: input.tenantId, email: input.email } },
  });

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        email: input.email,
        passwordHash: await hashSeedPassword(passwords, input.password, input.role),
        role: input.role,
        isActive: true,
      },
    }));

  if (user.role !== input.role) {
    throw new Error(
      'O e-mail de desenvolvimento já existe com outro papel. O seed não altera o papel.',
    );
  }

  if (input.role === 'CLIENT') {
    const profile = await prisma.client.findUnique({ where: { userId: user.id } });
    if (!profile) {
      await prisma.client.create({
        data: { tenantId: input.tenantId, userId: user.id, isActive: true },
      });
    }
    return;
  }

  const profile = await prisma.professional.findUnique({ where: { userId: user.id } });
  if (!profile) {
    await prisma.professional.create({
      data: {
        tenantId: input.tenantId,
        userId: user.id,
        displayName: input.displayName || user.name,
        isActive: true,
      },
    });
  }
}

async function hashSeedPassword(
  passwords: PasswordService,
  password: string,
  role: 'CLIENT' | 'PROFESSIONAL',
): Promise<string> {
  if (password.length < 12) {
    const variable = role === 'CLIENT' ? 'SEED_CLIENT_PASSWORD' : 'SEED_PROFESSIONAL_PASSWORD';
    throw new Error(`${variable} precisa ter pelo menos 12 caracteres.`);
  }
  return passwords.hash(password);
}

async function backfillClientProfiles(prisma: PrismaClient, tenantId: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { tenantId, role: 'CLIENT', client: { is: null } },
  });
  for (const user of users) {
    await prisma.client.create({
      data: { tenantId, userId: user.id, isActive: true },
    });
  }
}

async function ensureSchedule(prisma: PrismaClient, tenantId: string, email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (!user) {
    return;
  }
  const professional = await prisma.professional.findUnique({ where: { userId: user.id } });
  if (!professional) {
    return;
  }
  const existing = await prisma.professionalSchedule.count({
    where: { professionalId: professional.id },
  });
  if (existing > 0) {
    return;
  }

  const rows: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];
  for (const dayOfWeek of [1, 2, 3, 4, 5]) {
    rows.push({ dayOfWeek, startTime: '08:00', endTime: '12:00' });
    rows.push({ dayOfWeek, startTime: '13:30', endTime: '18:00' });
  }
  rows.push({ dayOfWeek: 6, startTime: '08:00', endTime: '14:00' });

  for (const row of rows) {
    await prisma.professionalSchedule.create({
      data: {
        tenantId,
        professionalId: professional.id,
        dayOfWeek: row.dayOfWeek,
        startTime: row.startTime,
        endTime: row.endTime,
        isActive: true,
      },
    });
  }
}

async function ensureServices(prisma: PrismaClient, tenantId: string): Promise<void> {
  const catalog = [
    {
      name: 'Corte',
      description: 'Corte masculino',
      price: '45.00',
      durationMinutes: 30,
      points: 10,
      redemptionPoints: 50,
    },
    {
      name: 'Barba',
      description: 'Barba completa',
      price: '30.00',
      durationMinutes: 20,
      points: 5,
      redemptionPoints: null,
    },
    {
      name: 'Corte + Barba',
      description: null,
      price: '70.00',
      durationMinutes: 50,
      points: 15,
      redemptionPoints: 100,
    },
  ];

  for (const item of catalog) {
    const existing = await prisma.service.findFirst({
      where: { tenantId, name: item.name },
    });
    if (!existing) {
      await prisma.service.create({
        data: {
          tenantId,
          name: item.name,
          description: item.description,
          price: item.price,
          durationMinutes: item.durationMinutes,
          points: item.points,
          redemptionPoints: item.redemptionPoints,
          isActive: true,
        },
      });
      continue;
    }
    if (existing.redemptionPoints == null && item.redemptionPoints != null) {
      await prisma.service.update({
        where: { id: existing.id },
        data: { redemptionPoints: item.redemptionPoints },
      });
    }
  }
}

async function ensureDevelopmentAppointment(
  prisma: PrismaClient,
  tenantId: string,
  clientEmail: string,
  professionalEmail: string,
): Promise<void> {
  const clientUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: clientEmail } },
  });
  const professionalUser = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: professionalEmail } },
  });
  if (!clientUser || !professionalUser) {
    return;
  }
  const client = await prisma.client.findUnique({ where: { userId: clientUser.id } });
  const professional = await prisma.professional.findUnique({
    where: { userId: professionalUser.id },
  });
  if (!client || !professional) {
    return;
  }
  const existing = await prisma.appointment.count({
    where: { professionalId: professional.id },
  });
  if (existing > 0) {
    return;
  }
  const service = await prisma.service.findFirst({
    where: { tenantId, name: 'Corte', isActive: true },
  });
  if (!service) {
    return;
  }

  let date = nextOrSameDate(todayInScheduleZone(), 1);
  let startAt = parseScheduleInstant(`${date}T10:00:00`);
  if (startAt.getTime() <= Date.now()) {
    date = addDays(date, 7);
    startAt = parseScheduleInstant(`${date}T10:00:00`);
  }
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
  await prisma.appointment.create({
    data: {
      tenantId,
      clientId: client.id,
      professionalId: professional.id,
      serviceId: service.id,
      startAt,
      endAt,
      status: 'CONFIRMED',
      notes: 'Agendamento de desenvolvimento',
      serviceNameSnapshot: service.name,
      servicePriceSnapshot: service.price,
      serviceDurationMinutesSnapshot: service.durationMinutes,
      pointsSnapshot: service.points,
    },
  });
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha no seed';
  console.error(message);
  process.exit(1);
});
