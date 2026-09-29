import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AppointmentStatus,
  AuthUser,
  DashboardAppointment,
  DashboardProfessional,
  OperationalDashboard,
} from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import {
  assertIsoDate,
  dayBounds,
  formatScheduleInstant,
  todayInScheduleZone,
} from '../../common/time/schedule-clock';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { DashboardQueryDto } from './dto/dashboard.query';

const NOT_FOUND = 'Recurso não encontrado';
const UPCOMING = new Set<AppointmentStatus>(['PENDING', 'CONFIRMED']);

type DayRow = Prisma.AppointmentGetPayload<{
  include: {
    client: { include: { user: { select: { name: true } } } };
    professional: { select: { id: true; displayName: true } };
    pointsTransactions: { select: { type: true; points: true } };
  };
}>;

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(actor: AuthUser, query: DashboardQueryDto): Promise<OperationalDashboard> {
    const date = this.resolveDate(query.date);
    if (query.professionalId) {
      await this.requireProfessional(actor.tenantId, query.professionalId);
    }
    const bounds = dayBounds(date);
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId: actor.tenantId,
        startAt: { gte: bounds.startAt, lt: bounds.endAt },
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
      },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      include: {
        client: { include: { user: { select: { name: true } } } },
        professional: { select: { id: true, displayName: true } },
        pointsTransactions: {
          where: { type: { in: ['REDEEM', 'REDEEM_REVERSAL', 'EARN'] } },
          select: { type: true, points: true },
        },
      },
    });
    const listed = query.status ? rows.filter((row) => row.status === query.status) : rows;
    return {
      date,
      summary: summarize(rows),
      upcoming: rows.filter((row) => UPCOMING.has(row.status)).map(toDashboardAppointment),
      appointments: listed.map(toDashboardAppointment),
      professionals: byProfessional(rows),
    };
  }

  private resolveDate(value: string | undefined): string {
    if (!value) {
      return todayInScheduleZone();
    }
    try {
      return assertIsoDate(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Data inválida.';
      throw new BadRequestException(message);
    }
  }

  private async requireProfessional(tenantId: string, professionalId: string): Promise<void> {
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(tenantId, professional.tenantId);
  }
}

function pointsOf(row: DayRow, type: 'REDEEM' | 'REDEEM_REVERSAL' | 'EARN'): number {
  return row.pointsTransactions.reduce((sum, transaction) => {
    return transaction.type === type ? sum + transaction.points : sum;
  }, 0);
}

function summarize(rows: DayRow[]): OperationalDashboard['summary'] {
  const servicesValue = rows.reduce(
    (total, row) => total.plus(row.servicePriceSnapshot),
    new Prisma.Decimal(0),
  );
  return {
    totalAppointments: rows.length,
    confirmed: rows.filter((row) => row.status === 'CONFIRMED').length,
    completed: rows.filter((row) => row.status === 'COMPLETED').length,
    cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
    noShow: rows.filter((row) => row.status === 'NO_SHOW').length,
    servicesValue: servicesValue.toFixed(2),
    pointsRedeemed: rows.reduce((sum, row) => sum + pointsOf(row, 'REDEEM'), 0),
    pointsReversed: rows.reduce((sum, row) => sum + pointsOf(row, 'REDEEM_REVERSAL'), 0),
    pointsEarned: rows.reduce((sum, row) => sum + pointsOf(row, 'EARN'), 0),
  };
}

function toDashboardAppointment(row: DayRow): DashboardAppointment {
  return {
    id: row.id,
    time: formatScheduleInstant(row.startAt).slice(11, 16),
    clientName: row.client.user.name,
    professionalName: row.professional.displayName,
    serviceName: row.serviceNameSnapshot,
    durationMinutes: row.serviceDurationMinutesSnapshot,
    price: row.servicePriceSnapshot.toFixed(2),
    status: row.status,
    bookingMode: row.bookingMode,
    redemptionPointsSnapshot: row.redemptionPointsSnapshot,
  };
}

function byProfessional(rows: DayRow[]): DashboardProfessional[] {
  const groups = new Map<string, DayRow[]>();
  for (const row of rows) {
    const current = groups.get(row.professionalId) ?? [];
    current.push(row);
    groups.set(row.professionalId, current);
  }
  return [...groups.entries()]
    .map(([professionalId, items]) => {
      const servicesValue = items.reduce(
        (total, row) => total.plus(row.servicePriceSnapshot),
        new Prisma.Decimal(0),
      );
      return {
        professionalId,
        name: items[0]?.professional.displayName ?? '',
        appointments: items.length,
        completed: items.filter((row) => row.status === 'COMPLETED').length,
        cancelled: items.filter((row) => row.status === 'CANCELLED').length,
        noShow: items.filter((row) => row.status === 'NO_SHOW').length,
        servicesValue: servicesValue.toFixed(2),
      };
    })
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, 'pt-BR');
      return byName === 0 ? left.professionalId.localeCompare(right.professionalId) : byName;
    });
}
