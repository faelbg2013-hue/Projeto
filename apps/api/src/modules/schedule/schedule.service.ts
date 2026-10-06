import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus, type Prisma } from '@prisma/client';
import type {
  AuthUser,
  Availability,
  BusinessHours,
  Paginated,
  ProfessionalSchedule,
  ScheduleException,
  ScheduleInterval,
  TimeBlock,
} from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import type { PaginationQueryDto } from '../../common/dto/pagination.query';
import { pageMeta, pageWindow } from '../../common/pagination';
import {
  assertIsoDate,
  dayBounds,
  dayOfWeek,
  formatScheduleInstant,
  parseScheduleInstant,
  parseWallTime,
  SLOT_STEP_MINUTES,
  todayInScheduleZone,
} from '../../common/time/schedule-clock';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { businessHoursDayKey, businessHoursError } from '../settings/business-hours';
import type { TenantSettingKey } from '../settings/settings.constants';
import { calculateAvailability, hasOverlap, type MinuteWindow } from './availability';
import type { AvailabilityQueryDto } from './dto/schedule.dto';
import type {
  CreateScheduleExceptionDto,
  CreateTimeBlockDto,
  ReplaceScheduleDto,
  UpdateScheduleExceptionDto,
} from './dto/schedule.dto';

const NOT_FOUND = 'Recurso não encontrado';
const INVALID_STORED_HOURS = 'Horário de funcionamento armazenado é inválido.';
const BUSINESS_HOURS_KEY = 'business_hours' satisfies TenantSettingKey;

export const OCCUPYING_APPOINTMENT_STATUSES = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.COMPLETED,
  AppointmentStatus.NO_SHOW,
] as const;

type ScheduleReader = Prisma.TransactionClient | PrismaService;
const INVALID_RANGE = 'O horário inicial precisa ser anterior ao horário final.';
const INTERVAL_OVERLAP = 'Os intervalos se sobrepõem.';
const BLOCK_OVERLAP = 'Os bloqueios se sobrepõem.';
const EXCEPTION_OVERLAP = 'As exceções se sobrepõem.';
const EXCEPTION_TIMES = 'Informe início e fim, ou deixe os dois vazios para o dia inteiro.';

type ScheduleRow = {
  id: string;
  tenantId: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type BlockRow = {
  id: string;
  tenantId: string;
  professionalId: string;
  startAt: Date;
  endAt: Date;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ExceptionRow = {
  id: string;
  tenantId: string;
  professionalId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: 'BLOCK' | 'OPEN';
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toInterval(row: ScheduleRow): ScheduleInterval {
  return {
    id: row.id,
    tenantId: row.tenantId,
    professionalId: row.professionalId,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toBlock(row: BlockRow): TimeBlock {
  return {
    id: row.id,
    tenantId: row.tenantId,
    professionalId: row.professionalId,
    startAt: formatScheduleInstant(row.startAt),
    endAt: formatScheduleInstant(row.endAt),
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toException(row: ExceptionRow): ScheduleException {
  return {
    id: row.id,
    tenantId: row.tenantId,
    professionalId: row.professionalId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    type: row.type,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function clockError(error: unknown): never {
  const message = error instanceof Error ? error.message : 'Data inválida.';
  throw new BadRequestException(message);
}

function optionalReason(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeExceptionTimes(
  start: string | null | undefined,
  end: string | null | undefined,
): { startTime: string | null; endTime: string | null } {
  const startTime = start ?? null;
  const endTime = end ?? null;
  if ((startTime === null) !== (endTime === null)) {
    throw new BadRequestException(EXCEPTION_TIMES);
  }
  if (startTime !== null && endTime !== null && parseWallTime(startTime) >= parseWallTime(endTime)) {
    throw new BadRequestException(INVALID_RANGE);
  }
  return { startTime, endTime };
}

function exceptionWindow(startTime: string | null, endTime: string | null): MinuteWindow {
  if (startTime === null || endTime === null) {
    return { start: 0, end: 24 * 60 };
  }
  return { start: parseWallTime(startTime), end: parseWallTime(endTime) };
}

function rangesTouch(left: MinuteWindow, right: MinuteWindow): boolean {
  return left.start < right.end && right.start < left.end;
}

@Injectable()
export class ScheduleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getOwnSchedule(actor: AuthUser): Promise<ProfessionalSchedule> {
    const professional = await this.requireOwn(actor);
    return this.readSchedule(professional.id, actor.tenantId);
  }

  async replaceOwnSchedule(actor: AuthUser, input: ReplaceScheduleDto): Promise<ProfessionalSchedule> {
    const professional = await this.requireOwn(actor);
    return this.replaceSchedule(actor.tenantId, professional.id, input);
  }

  async getSchedule(actor: AuthUser, professionalId: string): Promise<ProfessionalSchedule> {
    await this.requireInTenant(actor, professionalId);
    return this.readSchedule(professionalId, actor.tenantId);
  }

  async replaceScheduleFor(
    actor: AuthUser,
    professionalId: string,
    input: ReplaceScheduleDto,
  ): Promise<ProfessionalSchedule> {
    await this.requireInTenant(actor, professionalId);
    return this.replaceSchedule(actor.tenantId, professionalId, input);
  }

  async listOwnBlocks(actor: AuthUser, query: PaginationQueryDto): Promise<Paginated<TimeBlock>> {
    const professional = await this.requireOwn(actor);
    return this.listBlocks(actor.tenantId, professional.id, query);
  }

  async createOwnBlock(actor: AuthUser, input: CreateTimeBlockDto): Promise<TimeBlock> {
    const professional = await this.requireOwn(actor);
    return this.createBlock(actor.tenantId, professional.id, input);
  }

  async deleteOwnBlock(actor: AuthUser, blockId: string): Promise<void> {
    const professional = await this.requireOwn(actor);
    await this.deleteBlock(actor, professional.id, blockId);
  }

  async listBlocksFor(
    actor: AuthUser,
    professionalId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<TimeBlock>> {
    await this.requireInTenant(actor, professionalId);
    return this.listBlocks(actor.tenantId, professionalId, query);
  }

  async createBlockFor(
    actor: AuthUser,
    professionalId: string,
    input: CreateTimeBlockDto,
  ): Promise<TimeBlock> {
    await this.requireInTenant(actor, professionalId);
    return this.createBlock(actor.tenantId, professionalId, input);
  }

  async deleteBlockFor(actor: AuthUser, professionalId: string, blockId: string): Promise<void> {
    await this.requireInTenant(actor, professionalId);
    await this.deleteBlock(actor, professionalId, blockId);
  }

  async listOwnExceptions(
    actor: AuthUser,
    query: PaginationQueryDto,
  ): Promise<Paginated<ScheduleException>> {
    const professional = await this.requireOwn(actor);
    return this.listExceptions(actor.tenantId, professional.id, query);
  }

  async createOwnException(
    actor: AuthUser,
    input: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const professional = await this.requireOwn(actor);
    return this.createException(actor.tenantId, professional.id, input);
  }

  async updateOwnException(
    actor: AuthUser,
    exceptionId: string,
    input: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const professional = await this.requireOwn(actor);
    return this.updateException(actor, professional.id, exceptionId, input);
  }

  async deleteOwnException(actor: AuthUser, exceptionId: string): Promise<void> {
    const professional = await this.requireOwn(actor);
    await this.deleteException(actor, professional.id, exceptionId);
  }

  async listExceptionsFor(
    actor: AuthUser,
    professionalId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ScheduleException>> {
    await this.requireInTenant(actor, professionalId);
    return this.listExceptions(actor.tenantId, professionalId, query);
  }

  async createExceptionFor(
    actor: AuthUser,
    professionalId: string,
    input: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    await this.requireInTenant(actor, professionalId);
    return this.createException(actor.tenantId, professionalId, input);
  }

  async updateExceptionFor(
    actor: AuthUser,
    professionalId: string,
    exceptionId: string,
    input: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    await this.requireInTenant(actor, professionalId);
    return this.updateException(actor, professionalId, exceptionId, input);
  }

  async deleteExceptionFor(
    actor: AuthUser,
    professionalId: string,
    exceptionId: string,
  ): Promise<void> {
    await this.requireInTenant(actor, professionalId);
    await this.deleteException(actor, professionalId, exceptionId);
  }

  async getAvailability(
    actor: AuthUser,
    professionalId: string,
    query: AvailabilityQueryDto,
  ): Promise<Availability> {
    let date: string;
    try {
      date = assertIsoDate(query.date);
    } catch (error) {
      clockError(error);
    }

    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!professional || !professional.isActive) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);

    const service = await this.prisma.service.findUnique({ where: { id: query.serviceId } });
    if (!service || !service.isActive) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, service.tenantId);

    const empty: Availability = {
      date,
      professionalId,
      serviceId: service.id,
      durationMinutes: service.durationMinutes,
      slots: [],
    };
    if (date < todayInScheduleZone()) {
      return empty;
    }

    return {
      ...empty,
      slots: await this.computeSlots(this.prisma, {
        tenantId: actor.tenantId,
        professionalId,
        date,
        durationMinutes: service.durationMinutes,
      }),
    };
  }

  async computeSlots(
    db: ScheduleReader,
    input: { tenantId: string; professionalId: string; date: string; durationMinutes: number },
  ): Promise<string[]> {
    const bounds = dayBounds(input.date);
    const weekly = await db.professionalSchedule.findMany({
      where: {
        tenantId: input.tenantId,
        professionalId: input.professionalId,
        dayOfWeek: dayOfWeek(input.date),
        isActive: true,
      },
    });
    const exceptions = await db.professionalScheduleException.findMany({
      where: { tenantId: input.tenantId, professionalId: input.professionalId, date: input.date },
    });
    const blocks = await db.professionalTimeBlock.findMany({
      where: {
        tenantId: input.tenantId,
        professionalId: input.professionalId,
        startAt: { lt: bounds.endAt },
        endAt: { gt: bounds.startAt },
      },
    });
    const occupied = await db.appointment.findMany({
      where: {
        tenantId: input.tenantId,
        professionalId: input.professionalId,
        status: { in: [...OCCUPYING_APPOINTMENT_STATUSES] },
        startAt: { lt: bounds.endAt },
        endAt: { gt: bounds.startAt },
      },
      select: { startAt: true, endAt: true },
    });

    return calculateAvailability({
      date: input.date,
      durationMinutes: input.durationMinutes,
      stepMinutes: SLOT_STEP_MINUTES,
      weekly: weekly.map((row) => ({
        start: parseWallTime(row.startTime),
        end: parseWallTime(row.endTime),
      })),
      exceptions: exceptions.map((row) => ({
        type: row.type,
        start: row.startTime === null ? null : parseWallTime(row.startTime),
        end: row.endTime === null ? null : parseWallTime(row.endTime),
      })),
      blocks: blocks.map((row) => ({ startAt: row.startAt, endAt: row.endAt })),
      occupied,
      establishment: await this.establishmentWindows(db, input.tenantId, input.date),
    });
  }

  /**
   * null: o tenant ainda não gravou business_hours e a disponibilidade do profissional permanece a atual.
   * []: o dia está fechado no estabelecimento.
   */
  private async establishmentWindows(
    db: ScheduleReader,
    tenantId: string,
    date: string,
  ): Promise<MinuteWindow[] | null> {
    const row = await db.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: BUSINESS_HOURS_KEY } },
    });
    if (!row) {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      throw new BadRequestException(INVALID_STORED_HOURS);
    }
    if (businessHoursError(parsed)) {
      throw new BadRequestException(INVALID_STORED_HOURS);
    }

    const key = businessHoursDayKey(dayOfWeek(date));
    const day = key ? (parsed as BusinessHours)[key] : null;
    if (!day?.enabled || day.open == null || day.close == null) {
      return [];
    }
    return [{ start: parseWallTime(day.open), end: parseWallTime(day.close) }];
  }

  private async readSchedule(professionalId: string, tenantId: string): Promise<ProfessionalSchedule> {
    const rows = await this.prisma.professionalSchedule.findMany({
      where: { tenantId, professionalId, isActive: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return { professionalId, intervals: rows.map((row) => toInterval(row)) };
  }

  private async replaceSchedule(
    tenantId: string,
    professionalId: string,
    input: ReplaceScheduleDto,
  ): Promise<ProfessionalSchedule> {
    const prepared = input.intervals.map((interval) => {
      let start = 0;
      let end = 0;
      try {
        start = parseWallTime(interval.startTime);
        end = parseWallTime(interval.endTime);
      } catch (error) {
        clockError(error);
      }
      if (start >= end) {
        throw new BadRequestException(INVALID_RANGE);
      }
      return { dayOfWeek: interval.dayOfWeek, startTime: interval.startTime, endTime: interval.endTime, start, end };
    });

    const byDay = new Map<number, MinuteWindow[]>();
    for (const interval of prepared) {
      const current = byDay.get(interval.dayOfWeek) ?? [];
      current.push({ start: interval.start, end: interval.end });
      byDay.set(interval.dayOfWeek, current);
    }
    for (const ranges of byDay.values()) {
      if (hasOverlap(ranges)) {
        throw new BadRequestException(INTERVAL_OVERLAP);
      }
    }

    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.professionalSchedule.deleteMany({ where: { tenantId, professionalId } });
      const created: ScheduleRow[] = [];
      for (const interval of prepared) {
        created.push(
          await tx.professionalSchedule.create({
            data: {
              tenantId,
              professionalId,
              dayOfWeek: interval.dayOfWeek,
              startTime: interval.startTime,
              endTime: interval.endTime,
              isActive: true,
            },
          }),
        );
      }
      return created;
    });

    return {
      professionalId,
      intervals: rows
        .map((row) => toInterval(row))
        .sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime)),
    };
  }

  private async listBlocks(
    tenantId: string,
    professionalId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<TimeBlock>> {
    const window = pageWindow(query);
    const where = { tenantId, professionalId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professionalTimeBlock.findMany({
        where,
        orderBy: { startAt: 'desc' },
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.professionalTimeBlock.count({ where }),
    ]);
    return { data: rows.map((row) => toBlock(row)), meta: pageMeta(window.page, window.pageSize, total) };
  }

  private async createBlock(
    tenantId: string,
    professionalId: string,
    input: CreateTimeBlockDto,
  ): Promise<TimeBlock> {
    let startAt: Date;
    let endAt: Date;
    try {
      startAt = parseScheduleInstant(input.startAt);
      endAt = parseScheduleInstant(input.endAt);
    } catch (error) {
      clockError(error);
    }
    if (startAt.getTime() >= endAt.getTime()) {
      throw new BadRequestException(INVALID_RANGE);
    }
    const existing = await this.prisma.professionalTimeBlock.findMany({
      where: { tenantId, professionalId },
      select: { startAt: true, endAt: true },
    });
    const overlaps = existing.some(
      (block) => startAt.getTime() < block.endAt.getTime() && block.startAt.getTime() < endAt.getTime(),
    );
    if (overlaps) {
      throw new BadRequestException(BLOCK_OVERLAP);
    }
    const created = await this.prisma.professionalTimeBlock.create({
      data: {
        tenantId,
        professionalId,
        startAt,
        endAt,
        reason: optionalReason(input.reason),
      },
    });
    return toBlock(created);
  }

  private async deleteBlock(actor: AuthUser, professionalId: string, blockId: string): Promise<void> {
    const block = await this.prisma.professionalTimeBlock.findUnique({ where: { id: blockId } });
    if (!block || block.professionalId !== professionalId) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, block.tenantId);
    await this.prisma.professionalTimeBlock.delete({ where: { id: blockId } });
  }

  private async listExceptions(
    tenantId: string,
    professionalId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ScheduleException>> {
    const window = pageWindow(query);
    const where = { tenantId, professionalId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professionalScheduleException.findMany({
        where,
        orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.professionalScheduleException.count({ where }),
    ]);
    return {
      data: rows.map((row) => toException(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  private async createException(
    tenantId: string,
    professionalId: string,
    input: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    let date = input.date;
    try {
      date = assertIsoDate(input.date);
    } catch (error) {
      clockError(error);
    }
    let times: { startTime: string | null; endTime: string | null };
    try {
      times = normalizeExceptionTimes(input.startTime, input.endTime);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      clockError(error);
    }
    await this.assertExceptionFree(tenantId, professionalId, date, times.startTime, times.endTime);
    const created = await this.prisma.professionalScheduleException.create({
      data: {
        tenantId,
        professionalId,
        date,
        startTime: times.startTime,
        endTime: times.endTime,
        type: input.type,
        reason: optionalReason(input.reason),
      },
    });
    return toException(created);
  }

  private async updateException(
    actor: AuthUser,
    professionalId: string,
    exceptionId: string,
    input: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    const current = await this.requireException(actor, professionalId, exceptionId);
    let date = input.date ?? current.date;
    try {
      date = assertIsoDate(date);
    } catch (error) {
      clockError(error);
    }
    const start = input.startTime !== undefined ? input.startTime : current.startTime;
    const end = input.endTime !== undefined ? input.endTime : current.endTime;
    let times: { startTime: string | null; endTime: string | null };
    try {
      times = normalizeExceptionTimes(start, end);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      clockError(error);
    }
    await this.assertExceptionFree(
      actor.tenantId,
      professionalId,
      date,
      times.startTime,
      times.endTime,
      exceptionId,
    );
    const updated = await this.prisma.professionalScheduleException.update({
      where: { id: exceptionId },
      data: {
        date,
        startTime: times.startTime,
        endTime: times.endTime,
        type: input.type ?? current.type,
        reason: input.reason !== undefined ? optionalReason(input.reason) : current.reason,
      },
    });
    return toException(updated);
  }

  private async deleteException(
    actor: AuthUser,
    professionalId: string,
    exceptionId: string,
  ): Promise<void> {
    await this.requireException(actor, professionalId, exceptionId);
    await this.prisma.professionalScheduleException.delete({ where: { id: exceptionId } });
  }

  private async assertExceptionFree(
    tenantId: string,
    professionalId: string,
    date: string,
    startTime: string | null,
    endTime: string | null,
    ignoreId?: string,
  ): Promise<void> {
    const others = await this.prisma.professionalScheduleException.findMany({
      where: { tenantId, professionalId, date, ...(ignoreId ? { id: { not: ignoreId } } : {}) },
    });
    const next = exceptionWindow(startTime, endTime);
    const overlaps = others.some((item) => rangesTouch(next, exceptionWindow(item.startTime, item.endTime)));
    if (overlaps) {
      throw new BadRequestException(EXCEPTION_OVERLAP);
    }
  }

  private async requireException(
    actor: AuthUser,
    professionalId: string,
    exceptionId: string,
  ): Promise<ExceptionRow> {
    const exception = await this.prisma.professionalScheduleException.findUnique({
      where: { id: exceptionId },
    });
    if (!exception || exception.professionalId !== professionalId) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, exception.tenantId);
    return exception;
  }

  private async requireOwn(actor: AuthUser): Promise<{ id: string; tenantId: string }> {
    const professional = await this.prisma.professional.findUnique({ where: { userId: actor.id } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return professional;
  }

  private async requireInTenant(actor: AuthUser, professionalId: string): Promise<{ id: string }> {
    const professional = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return professional;
  }
}
