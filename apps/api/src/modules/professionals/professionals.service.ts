import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type {
  AdminProfessionalAppointment,
  AdminProfessionalDetail,
  AuthUser,
  BookableProfessional,
  Paginated,
  ProfessionalProfile,
} from '@ravion/types';
import { UserRole } from '@ravion/types';
import { operationalUserSelect, toOperationalUser } from '../../common/auth/operational-user';
import { PasswordService } from '../../common/auth/password.service';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { pageMeta, pageWindow } from '../../common/pagination';
import { dayBounds, formatScheduleInstant, todayInScheduleZone } from '../../common/time/schedule-clock';
import { ScheduleNow } from '../../common/time/schedule-now';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AdminProfessionalQueryDto } from './dto/admin-professional.query';
import type { CreateProfessionalDto } from './dto/create-professional.dto';
import type { UpdateProfessionalDto } from './dto/update-professional.dto';

const NOT_FOUND = 'Recurso não encontrado';
const PREVIEW_LIMIT = 5;
const UPCOMING_STATUSES: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
const HISTORY_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const previewInclude = {
  client: { select: { user: { select: { name: true } } } },
} satisfies Prisma.AppointmentInclude;

type PreviewRow = Prisma.AppointmentGetPayload<{ include: typeof previewInclude }>;

type ProfessionalRow = {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthUser['role'];
    isActive: boolean;
  };
};

function toPreview(row: PreviewRow): AdminProfessionalAppointment {
  const start = formatScheduleInstant(row.startAt);
  return {
    date: start.slice(0, 10),
    time: start.slice(11, 16),
    clientName: row.client.user.name,
    serviceName: row.serviceNameSnapshot,
    status: row.status,
    bookingMode: row.bookingMode,
  };
}

function toProfessional(professional: ProfessionalRow): ProfessionalProfile {
  return {
    id: professional.id,
    tenantId: professional.tenantId,
    userId: professional.userId,
    displayName: professional.displayName,
    isActive: professional.isActive,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
    user: toOperationalUser(professional.user),
  };
}

@Injectable()
export class ProfessionalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(ScheduleNow) private readonly clock: ScheduleNow,
  ) {}

  async list(actor: AuthUser, query: AdminProfessionalQueryDto): Promise<Paginated<ProfessionalProfile>> {
    const window = pageWindow(query);
    const search = query.search?.trim();
    const where: Prisma.ProfessionalWhereInput = {
      tenantId: actor.tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            OR: [
              { displayName: { contains: search } },
              { user: { OR: [{ name: { contains: search } }, { email: { contains: search } }] } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professional.findMany({
        where,
        include: { user: { select: operationalUserSelect } },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      data: rows.map((row) => toProfessional(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async listBookable(actor: AuthUser, query: { page?: number; pageSize?: number }): Promise<Paginated<BookableProfessional>> {
    const window = pageWindow(query);
    const where = { tenantId: actor.tenantId, isActive: true };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professional.findMany({
        where,
        orderBy: { displayName: 'asc' },
        skip: window.skip,
        take: window.pageSize,
        select: { id: true, displayName: true },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      data: rows,
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async findMine(actor: AuthUser): Promise<ProfessionalProfile> {
    const professional = await this.prisma.professional.findUnique({
      where: { userId: actor.id },
      include: { user: { select: operationalUserSelect } },
    });
    if (!professional || professional.user.role !== UserRole.PROFESSIONAL) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return toProfessional(professional);
  }

  async find(actor: AuthUser, professionalId: string): Promise<ProfessionalProfile> {
    return toProfessional(await this.requireSameTenant(actor, professionalId));
  }

  async overview(actor: AuthUser, professionalId: string): Promise<AdminProfessionalDetail> {
    const professional = await this.requireSameTenant(actor, professionalId);
    const now = this.clock.now();
    const today = dayBounds(todayInScheduleZone(now));
    const scope = { tenantId: actor.tenantId, professionalId };
    const [groups, todayTotal, upcomingTotal, upcoming, history, services, week] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.appointment.count({
        where: { ...scope, startAt: { gte: today.startAt, lt: today.endAt } },
      }),
      this.prisma.appointment.count({
        where: { ...scope, status: { in: UPCOMING_STATUSES }, startAt: { gt: now } },
      }),
      this.prisma.appointment.findMany({
        where: { ...scope, status: { in: UPCOMING_STATUSES }, startAt: { gt: now } },
        include: previewInclude,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        take: PREVIEW_LIMIT,
      }),
      this.prisma.appointment.findMany({
        where: { ...scope, status: { in: HISTORY_STATUSES } },
        include: previewInclude,
        orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
        take: PREVIEW_LIMIT,
      }),
      this.prisma.service.findMany({
        where: { tenantId: actor.tenantId },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { name: true, durationMinutes: true, isActive: true, price: true },
      }),
      this.prisma.professionalSchedule.findMany({
        where: { tenantId: actor.tenantId, professionalId, isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
        select: { dayOfWeek: true, startTime: true, endTime: true },
      }),
    ]);
    const counts = new Map(groups.map((row) => [row.status, row._count._all]));
    const pick = (status: AppointmentStatus): number => counts.get(status) ?? 0;
    return {
      displayName: professional.displayName,
      name: professional.user.name,
      email: professional.user.email,
      isActive: professional.isActive,
      createdAt: professional.createdAt.toISOString(),
      services: services.map((service) => ({
        name: service.name,
        durationMinutes: service.durationMinutes,
        isActive: service.isActive,
        price: service.price.toFixed(2),
      })),
      week,
      appointments: {
        summary: {
          total: [...counts.values()].reduce((sum, value) => sum + value, 0),
          today: todayTotal,
          upcoming: upcomingTotal,
          pending: pick(AppointmentStatus.PENDING),
          confirmed: pick(AppointmentStatus.CONFIRMED),
          completed: pick(AppointmentStatus.COMPLETED),
          cancelled: pick(AppointmentStatus.CANCELLED),
          noShow: pick(AppointmentStatus.NO_SHOW),
        },
        upcoming: upcoming.map((row) => toPreview(row)),
        history: history.map((row) => toPreview(row)),
      },
    };
  }

  async create(actor: AuthUser, input: CreateProfessionalDto): Promise<ProfessionalProfile> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId: actor.tenantId,
            name: input.name,
            email: input.email,
            passwordHash,
            role: UserRole.PROFESSIONAL,
            isActive: true,
          },
        });
        if (user.role !== UserRole.PROFESSIONAL || user.tenantId !== actor.tenantId) {
          throw new BadRequestException('O usuário não possui o papel exigido.');
        }
        const professional = await tx.professional.create({
          data: {
            tenantId: actor.tenantId,
            userId: user.id,
            displayName: input.displayName,
            isActive: true,
          },
          include: { user: { select: operationalUserSelect } },
        });
        return toProfessional(professional);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Não foi possível criar o profissional.');
      }
      throw error;
    }
  }

  async update(
    actor: AuthUser,
    professionalId: string,
    input: UpdateProfessionalDto,
  ): Promise<ProfessionalProfile> {
    await this.requireSameTenant(actor, professionalId);
    const professional = await this.prisma.professional.update({
      where: { id: professionalId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { user: { select: operationalUserSelect } },
    });
    return toProfessional(professional);
  }

  async deactivate(actor: AuthUser, professionalId: string): Promise<ProfessionalProfile> {
    await this.requireSameTenant(actor, professionalId);
    const professional = await this.prisma.professional.update({
      where: { id: professionalId },
      data: { isActive: false },
      include: { user: { select: operationalUserSelect } },
    });
    return toProfessional(professional);
  }

  private async requireSameTenant(
    actor: AuthUser,
    professionalId: string,
  ): Promise<ProfessionalRow> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: { select: operationalUserSelect } },
    });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return professional;
  }
}
