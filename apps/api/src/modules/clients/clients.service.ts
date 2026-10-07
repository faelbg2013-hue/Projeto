import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import type {
  AdminClientAppointment,
  AdminClientDetail,
  AuthUser,
  ClientProfile,
  Paginated,
} from '@ravion/types';
import { UserRole } from '@ravion/types';
import { operationalUserSelect, toOperationalUser } from '../../common/auth/operational-user';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { pageMeta, pageWindow } from '../../common/pagination';
import { formatScheduleInstant } from '../../common/time/schedule-clock';
import { ScheduleNow } from '../../common/time/schedule-now';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PointsService } from '../points/points.service';
import type { AdminClientQueryDto } from './dto/admin-client.query';
import type { UpdateClientDto } from './dto/update-client.dto';

const NOT_FOUND = 'Recurso não encontrado';
const PREVIEW_LIMIT = 5;
const UPCOMING_STATUSES: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
const HISTORY_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

const previewInclude = {
  professional: { select: { displayName: true } },
} satisfies Prisma.AppointmentInclude;

type ClientRow = {
  id: string;
  tenantId: string;
  userId: string;
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

type PreviewRow = Prisma.AppointmentGetPayload<{ include: typeof previewInclude }>;

function toClient(client: ClientRow): ClientProfile {
  return {
    id: client.id,
    tenantId: client.tenantId,
    userId: client.userId,
    isActive: client.isActive,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    user: toOperationalUser(client.user),
  };
}

function toPreview(row: PreviewRow): AdminClientAppointment {
  const start = formatScheduleInstant(row.startAt);
  return {
    date: start.slice(0, 10),
    time: start.slice(11, 16),
    professionalName: row.professional.displayName,
    serviceName: row.serviceNameSnapshot,
    status: row.status,
    bookingMode: row.bookingMode,
  };
}

@Injectable()
export class ClientsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PointsService) private readonly points: PointsService,
    @Inject(ScheduleNow) private readonly clock: ScheduleNow,
  ) {}

  async list(actor: AuthUser, query: AdminClientQueryDto): Promise<Paginated<ClientProfile>> {
    const window = pageWindow(query);
    const search = query.search?.trim();
    const where: Prisma.ClientWhereInput = {
      tenantId: actor.tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(search
        ? {
            user: {
              OR: [{ name: { contains: search } }, { email: { contains: search } }],
            },
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: { user: { select: operationalUserSelect } },
        orderBy: [{ user: { name: 'asc' } }, { id: 'asc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);
    return {
      data: rows.map((row) => toClient(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async findMine(actor: AuthUser): Promise<ClientProfile> {
    const client = await this.prisma.client.findUnique({
      where: { userId: actor.id },
      include: { user: { select: operationalUserSelect } },
    });
    if (!client || client.user.role !== UserRole.CLIENT) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    return toClient(client);
  }

  async find(actor: AuthUser, clientId: string): Promise<ClientProfile> {
    return toClient(await this.requireSameTenant(actor, clientId));
  }

  async overview(actor: AuthUser, clientId: string): Promise<AdminClientDetail> {
    const client = await this.requireSameTenant(actor, clientId);
    const now = this.clock.now();
    const scope = { tenantId: actor.tenantId, clientId };
    const [groups, upcomingTotal, upcoming, history, ledger] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
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
      this.points.recentLedger(actor.tenantId, clientId, PREVIEW_LIMIT),
    ]);
    const counts = new Map(groups.map((row) => [row.status, row._count._all]));
    const pick = (status: AppointmentStatus): number => counts.get(status) ?? 0;
    return {
      name: client.user.name,
      email: client.user.email,
      isActive: client.isActive,
      createdAt: client.createdAt.toISOString(),
      points: {
        balance: ledger.balance,
        recent: ledger.recent.map((item) => ({
          type: item.type,
          points: item.points,
          reason: item.reason,
          createdAt: item.createdAt,
        })),
      },
      appointments: {
        summary: {
          total: [...counts.values()].reduce((sum, value) => sum + value, 0),
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

  async update(actor: AuthUser, clientId: string, input: UpdateClientDto): Promise<ClientProfile> {
    await this.requireSameTenant(actor, clientId);
    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { user: { select: operationalUserSelect } },
    });
    return toClient(client);
  }

  private async requireSameTenant(actor: AuthUser, clientId: string): Promise<ClientRow> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: { select: operationalUserSelect } },
    });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    return client;
  }
}
