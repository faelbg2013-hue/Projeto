import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthUser, BusinessHours, TenantSettingValues, TenantSettingsResponse } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  BOOKING_MIN_ADVANCE_KEY,
  CANCELLATION_MIN_ADVANCE_KEY,
  parseStoredAdvanceMinutes,
} from './advance-policy';
import { businessHoursError, toStoredBusinessHours } from './business-hours';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import { type TenantSettingKey } from './settings.constants';

const BUSINESS_HOURS_KEY = 'business_hours' satisfies TenantSettingKey;
const BOOKING_KEY = BOOKING_MIN_ADVANCE_KEY satisfies TenantSettingKey;
const CANCELLATION_KEY = CANCELLATION_MIN_ADVANCE_KEY satisfies TenantSettingKey;

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(actor: AuthUser): Promise<TenantSettingsResponse> {
    return { settings: await this.read(actor.tenantId) };
  }

  async update(actor: AuthUser, body: UpdateSettingsDto): Promise<TenantSettingsResponse> {
    const hours = body.settings?.business_hours;
    if (hours) {
      const stored = JSON.stringify(toStoredBusinessHours(hours));
      await this.upsert(actor.tenantId, BUSINESS_HOURS_KEY, stored);
    }
    if (body.settings?.booking_min_advance_minutes !== undefined) {
      await this.upsert(actor.tenantId, BOOKING_KEY, String(body.settings.booking_min_advance_minutes));
    }
    if (body.settings?.cancellation_min_advance_minutes !== undefined) {
      await this.upsert(actor.tenantId, CANCELLATION_KEY, String(body.settings.cancellation_min_advance_minutes));
    }

    return { settings: await this.read(actor.tenantId) };
  }

  private async upsert(tenantId: string, key: TenantSettingKey, value: string): Promise<void> {
    await this.prisma.tenantSetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      create: { tenantId, key, value },
      update: { value },
    });
  }

  private async read(tenantId: string): Promise<TenantSettingValues> {
    const rows = await this.prisma.tenantSetting.findMany({
      where: { tenantId, key: { in: [BUSINESS_HOURS_KEY, BOOKING_KEY, CANCELLATION_KEY] } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));
    const settings: TenantSettingValues = {
      booking_min_advance_minutes: decodeAdvance(byKey.get(BOOKING_KEY)),
      cancellation_min_advance_minutes: decodeAdvance(byKey.get(CANCELLATION_KEY)),
    };
    const hours = byKey.get(BUSINESS_HOURS_KEY);
    if (hours) {
      settings.business_hours = decodeBusinessHours(hours);
    }
    return settings;
  }
}

function decodeAdvance(raw: string | undefined): number {
  if (raw === undefined) {
    return 0;
  }
  const minutes = parseStoredAdvanceMinutes(raw);
  if (minutes === null) {
    throw new BadRequestException('Antecedência armazenada é inválida.');
  }
  return minutes;
}

function decodeBusinessHours(raw: string): BusinessHours {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException('Horário de funcionamento armazenado é inválido.');
  }

  if (businessHoursError(parsed)) {
    throw new BadRequestException('Horário de funcionamento armazenado é inválido.');
  }

  return parsed as BusinessHours;
}
