import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser, ProfessionalDay, ProfessionalDayAppointment } from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import {
  assertIsoDate,
  dayBounds,
  formatScheduleInstant,
  todayInScheduleZone,
} from '../../common/time/schedule-clock';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ProfessionalDayQueryDto } from './dto/professional-day.query';

const NOT_FOUND = 'Recurso não encontrado';

const dayInclude = {
  client: { select: { user: { select: { name: true } } } },
  service: { select: { description: true } },
} satisfies Prisma.AppointmentInclude;

type DayRow = Prisma.AppointmentGetPayload<{ include: typeof dayInclude }>;

@Injectable()
export class ProfessionalDayService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(actor: AuthUser, query: ProfessionalDayQueryDto): Promise<ProfessionalDay> {
    const date = this.resolveDate(query.date);
    const professional = await this.prisma.professional.findUnique({ where: { userId: actor.id } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    const bounds = dayBounds(date);
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId: actor.tenantId,
        professionalId: professional.id,
        startAt: { gte: bounds.startAt, lt: bounds.endAt },
      },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      include: dayInclude,
    });
    const now = Date.now();
    const current = rows.find(
      (row) => row.status === 'CONFIRMED' && row.startAt.getTime() <= now && now < row.endAt.getTime(),
    );
    const next = rows.find((row) => row.status === 'CONFIRMED' && row.startAt.getTime() > now);
    return {
      date,
      summary: {
        total: rows.length,
        confirmed: rows.filter((row) => row.status === 'CONFIRMED').length,
        completed: rows.filter((row) => row.status === 'COMPLETED').length,
        noShow: rows.filter((row) => row.status === 'NO_SHOW').length,
        cancelled: rows.filter((row) => row.status === 'CANCELLED').length,
      },
      nextAppointment: next ? toDayAppointment(next) : null,
      currentAppointment: current ? toDayAppointment(current) : null,
      appointments: rows.map(toDayAppointment),
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
}

function toDayAppointment(row: DayRow): ProfessionalDayAppointment {
  const start = formatScheduleInstant(row.startAt);
  const end = formatScheduleInstant(row.endAt);
  const description = row.service.description?.trim() ?? '';
  return {
    id: row.id,
    startAt: start,
    endAt: end,
    time: start.slice(11, 16),
    endTime: end.slice(11, 16),
    clientName: row.client.user.name,
    serviceName: row.serviceNameSnapshot,
    serviceDescription: description.length > 0 ? description : null,
    durationMinutes: row.serviceDurationMinutesSnapshot,
    price: row.servicePriceSnapshot.toFixed(2),
    status: row.status,
    bookingMode: row.bookingMode,
    redemptionPointsSnapshot: row.redemptionPointsSnapshot,
    pointsSnapshot: row.pointsSnapshot,
  };
}
