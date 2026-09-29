import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { UserRole, type AppointmentItem, type AuthUser, type Paginated } from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { pageMeta, pageWindow } from '../../common/pagination';
import {
  assertIsoDate,
  dayBounds,
  formatScheduleInstant,
  parseScheduleInstant,
  todayInScheduleZone,
} from '../../common/time/schedule-clock';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import type {
  AdminAppointmentQueryDto,
  AppointmentMeQueryDto,
  CreateAppointmentDto,
  ProfessionalAppointmentQueryDto,
} from './dto/appointment.dto';

const NOT_FOUND = 'Recurso não encontrado';
const PAST_DATE = 'Não é possível agendar em uma data passada.';
const PAST_TIME = 'O horário já passou.';
const TAKEN = 'Este horário não está mais disponível.';
const TRANSITION = 'A transição de status não é permitida.';
const IDEMPOTENCY = 'A chave de idempotência já foi utilizada.';
const INACTIVE_CLIENT = 'O cliente está inativo.';
const INVALID_KEY = 'Chave de idempotência inválida.';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,80}$/;

const appointmentInclude = {
  client: { select: { userId: true, user: { select: { name: true } } } },
  professional: { select: { userId: true, displayName: true } },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

function toAppointment(row: AppointmentRow): AppointmentItem {
  const start = formatScheduleInstant(row.startAt);
  const end = formatScheduleInstant(row.endAt);
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    professionalId: row.professionalId,
    serviceId: row.serviceId,
    clientName: row.client.user.name,
    professionalName: row.professional.displayName,
    serviceName: row.serviceNameSnapshot,
    price: row.servicePriceSnapshot.toFixed(2),
    durationMinutes: row.serviceDurationMinutesSnapshot,
    date: start.slice(0, 10),
    time: start.slice(11, 16),
    startAt: start,
    endAt: end,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  };
}

function optionalNotes(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function clockError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Data inválida.';
  throw new BadRequestException(message);
}

function isRetryableWrite(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    const message = error instanceof Error ? error.message : '';
    return message.includes('Lock wait timeout') || message.includes('Deadlock');
  }
  return error.code === 'P2002' || error.code === 'P2034';
}

@Injectable()
export class AppointmentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScheduleService) private readonly schedule: ScheduleService,
  ) {}

  async create(
    actor: AuthUser,
    input: CreateAppointmentDto,
    idempotencyKey?: string,
  ): Promise<AppointmentItem> {
    const key = this.normalizeKey(idempotencyKey);
    let date = input.date;
    try {
      date = assertIsoDate(input.date);
    } catch (error) {
      clockError(error);
    }
    if (date < todayInScheduleZone()) {
      throw new BadRequestException(PAST_DATE);
    }
    let startAt: Date;
    try {
      startAt = parseScheduleInstant(`${date}T${input.time}:00`);
    } catch (error) {
      clockError(error);
    }
    if (startAt.getTime() <= Date.now()) {
      throw new BadRequestException(PAST_TIME);
    }
    const notes = optionalNotes(input.notes);

    const client = await this.prisma.client.findUnique({ where: { userId: actor.id } });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    if (!client.isActive) {
      throw new ForbiddenException(INACTIVE_CLIENT);
    }

    if (key) {
      const replay = await this.findReplay(actor.tenantId, client.id, key);
      if (replay) {
        return this.replayOrReject(replay, input, notes);
      }
    }

    const professional = await this.prisma.professional.findUnique({ where: { id: input.professionalId } });
    if (!professional || !professional.isActive) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    const service = await this.prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!service || !service.isActive) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, service.tenantId);

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM professionals WHERE id = ${professional.id} AND tenantId = ${actor.tenantId} FOR UPDATE
          `;
          if (locked.length === 0) {
            throw new NotFoundException(NOT_FOUND);
          }

          const professionalNow = await tx.professional.findUnique({ where: { id: professional.id } });
          if (!professionalNow || !professionalNow.isActive || professionalNow.tenantId !== actor.tenantId) {
            throw new NotFoundException(NOT_FOUND);
          }
          const serviceNow = await tx.service.findUnique({ where: { id: service.id } });
          if (!serviceNow || !serviceNow.isActive || serviceNow.tenantId !== actor.tenantId) {
            throw new NotFoundException(NOT_FOUND);
          }
          const clientNow = await tx.client.findUnique({ where: { id: client.id } });
          if (!clientNow || clientNow.tenantId !== actor.tenantId) {
            throw new NotFoundException(NOT_FOUND);
          }
          if (!clientNow.isActive) {
            throw new ForbiddenException(INACTIVE_CLIENT);
          }

          const endAt = new Date(startAt.getTime() + serviceNow.durationMinutes * 60_000);
          const slots = await this.schedule.computeSlots(tx, {
            tenantId: actor.tenantId,
            professionalId: professionalNow.id,
            date,
            durationMinutes: serviceNow.durationMinutes,
          });
          if (!slots.includes(input.time)) {
            throw new ConflictException(TAKEN);
          }
          const clash = await tx.appointment.findFirst({
            where: {
              tenantId: actor.tenantId,
              professionalId: professionalNow.id,
              status: { in: ['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
            select: { id: true },
          });
          if (clash) {
            throw new ConflictException(TAKEN);
          }

          return tx.appointment.create({
            data: {
              tenantId: actor.tenantId,
              clientId: clientNow.id,
              professionalId: professionalNow.id,
              serviceId: serviceNow.id,
              startAt,
              endAt,
              status: AppointmentStatus.CONFIRMED,
              notes,
              serviceNameSnapshot: serviceNow.name,
              servicePriceSnapshot: serviceNow.price,
              serviceDurationMinutesSnapshot: serviceNow.durationMinutes,
              idempotencyKey: key,
            },
            include: appointmentInclude,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 },
      );
      return toAppointment(created);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' && key) {
        const replay = await this.findReplay(actor.tenantId, client.id, key);
        if (replay) {
          return this.replayOrReject(replay, input, notes);
        }
      }
      if (isRetryableWrite(error) && !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw new ConflictException(TAKEN);
      }
      throw error;
    }
  }

  async listMine(actor: AuthUser, query: AppointmentMeQueryDto): Promise<Paginated<AppointmentItem>> {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.id } });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    const statuses =
      query.view === 'history'
        ? [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]
        : query.view === 'upcoming'
          ? [AppointmentStatus.CONFIRMED]
          : undefined;
    return this.listWhere(actor.tenantId, { clientId: client.id, ...(statuses ? { status: { in: statuses } } : {}) }, query);
  }

  async listForProfessional(
    actor: AuthUser,
    query: ProfessionalAppointmentQueryDto,
  ): Promise<Paginated<AppointmentItem>> {
    const professional = await this.prisma.professional.findUnique({ where: { userId: actor.id } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    const range = this.dateRange(query.date);
    return this.listWhere(
      actor.tenantId,
      {
        professionalId: professional.id,
        ...(query.status ? { status: query.status } : {}),
        ...(range ? { startAt: range } : {}),
      },
      query,
    );
  }

  async listForAdmin(actor: AuthUser, query: AdminAppointmentQueryDto): Promise<Paginated<AppointmentItem>> {
    if (query.professionalId) {
      await this.requireProfessional(actor.tenantId, query.professionalId);
    }
    if (query.clientId) {
      await this.requireClient(actor.tenantId, query.clientId);
    }
    if (query.serviceId) {
      await this.requireService(actor.tenantId, query.serviceId);
    }
    const range = this.adminRange(query);
    return this.listWhere(
      actor.tenantId,
      {
        ...(query.professionalId ? { professionalId: query.professionalId } : {}),
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.serviceId ? { serviceId: query.serviceId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(range ? { startAt: range } : {}),
      },
      query,
    );
  }

  async find(actor: AuthUser, appointmentId: string): Promise<AppointmentItem> {
    return toAppointment(await this.requireVisible(actor, appointmentId));
  }

  async cancel(actor: AuthUser, appointmentId: string): Promise<AppointmentItem> {
    return this.transition(actor, appointmentId, 'cancel');
  }

  async complete(actor: AuthUser, appointmentId: string): Promise<AppointmentItem> {
    return this.transition(actor, appointmentId, 'complete');
  }

  async markNoShow(actor: AuthUser, appointmentId: string): Promise<AppointmentItem> {
    return this.transition(actor, appointmentId, 'no-show');
  }

  private async transition(
    actor: AuthUser,
    appointmentId: string,
    action: 'cancel' | 'complete' | 'no-show',
  ): Promise<AppointmentItem> {
    const updated = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM appointments WHERE id = ${appointmentId} FOR UPDATE
        `;
        if (locked.length === 0) {
          throw new NotFoundException(NOT_FOUND);
        }
        const current = await tx.appointment.findUnique({
          where: { id: appointmentId },
          include: appointmentInclude,
        });
        if (!current) {
          throw new NotFoundException(NOT_FOUND);
        }
        this.assertVisible(actor, current, action);
        if (current.status !== AppointmentStatus.CONFIRMED) {
          throw new ConflictException(TRANSITION);
        }
        return tx.appointment.update({
          where: { id: appointmentId },
          data:
            action === 'cancel'
              ? { status: AppointmentStatus.CANCELLED, cancelledAt: new Date() }
              : action === 'complete'
                ? { status: AppointmentStatus.COMPLETED, completedAt: new Date() }
                : { status: AppointmentStatus.NO_SHOW },
          include: appointmentInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 },
    );
    return toAppointment(updated);
  }

  private assertVisible(
    actor: AuthUser,
    appointment: AppointmentRow,
    action: 'read' | 'cancel' | 'complete' | 'no-show',
  ): void {
    denyCrossTenant(actor.tenantId, appointment.tenantId);
    const ownsAsClient = appointment.client.userId === actor.id;
    const ownsAsProfessional = appointment.professional.userId === actor.id;
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role === UserRole.CLIENT && ownsAsClient) {
      if (action === 'complete' || action === 'no-show') {
        throw new ForbiddenException('Acesso negado.');
      }
      return;
    }
    if (actor.role === UserRole.PROFESSIONAL && ownsAsProfessional) {
      return;
    }
    throw new NotFoundException(NOT_FOUND);
  }

  private async requireVisible(actor: AuthUser, appointmentId: string): Promise<AppointmentRow> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: appointmentInclude,
    });
    if (!appointment) {
      throw new NotFoundException(NOT_FOUND);
    }
    this.assertVisible(actor, appointment, 'read');
    return appointment;
  }

  private async listWhere(
    tenantId: string,
    where: Prisma.AppointmentWhereInput,
    query: { page?: number; pageSize?: number },
  ): Promise<Paginated<AppointmentItem>> {
    const window = pageWindow(query);
    const scoped = { ...where, tenantId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where: scoped,
        include: appointmentInclude,
        orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.appointment.count({ where: scoped }),
    ]);
    return {
      data: rows.map((row) => toAppointment(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  private dateRange(date: string | undefined): { gte: Date; lt: Date } | undefined {
    if (!date) {
      return undefined;
    }
    let valid = date;
    try {
      valid = assertIsoDate(date);
    } catch (error) {
      clockError(error);
    }
    const bounds = dayBounds(valid);
    return { gte: bounds.startAt, lt: bounds.endAt };
  }

  private adminRange(query: AdminAppointmentQueryDto): { gte?: Date; lt?: Date } | undefined {
    if (query.date) {
      return this.dateRange(query.date);
    }
    if (!query.startDate && !query.endDate) {
      return undefined;
    }
    const start = query.startDate ? this.dateRange(query.startDate)?.gte : undefined;
    const end = query.endDate ? this.dateRange(query.endDate)?.lt : undefined;
    if (start && end && start >= end) {
      throw new BadRequestException('Data inválida.');
    }
    return { ...(start ? { gte: start } : {}), ...(end ? { lt: end } : {}) };
  }

  private async requireProfessional(tenantId: string, professionalId: string): Promise<void> {
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(tenantId, professional.tenantId);
  }

  private async requireClient(tenantId: string, clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(tenantId, client.tenantId);
  }

  private async requireService(tenantId: string, serviceId: string): Promise<void> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(tenantId, service.tenantId);
  }

  private normalizeKey(value: string | undefined): string | null {
    if (value === undefined || value.trim() === '') {
      return null;
    }
    const key = value.trim();
    if (!KEY_PATTERN.test(key)) {
      throw new BadRequestException(INVALID_KEY);
    }
    return key;
  }

  private findReplay(tenantId: string, clientId: string, key: string): Promise<AppointmentRow | null> {
    return this.prisma.appointment.findUnique({
      where: { tenantId_clientId_idempotencyKey: { tenantId, clientId, idempotencyKey: key } },
      include: appointmentInclude,
    });
  }

  private replayOrReject(row: AppointmentRow, input: CreateAppointmentDto, notes: string | null): AppointmentItem {
    const start = formatScheduleInstant(row.startAt);
    const same =
      row.professionalId === input.professionalId &&
      row.serviceId === input.serviceId &&
      start.slice(0, 10) === input.date &&
      start.slice(11, 16) === input.time &&
      (row.notes ?? null) === notes;
    if (!same) {
      throw new ConflictException(IDEMPOTENCY);
    }
    return toAppointment(row);
  }
}
