import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthUser, BusinessHours, TenantSettingValues, TenantSettingsResponse } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { businessHoursError, toStoredBusinessHours } from './business-hours';
import type { UpdateSettingsDto } from './dto/update-settings.dto';
import { type TenantSettingKey } from './settings.constants';

const BUSINESS_HOURS_KEY = 'business_hours' satisfies TenantSettingKey;

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
      await this.prisma.tenantSetting.upsert({
        where: { tenantId_key: { tenantId: actor.tenantId, key: BUSINESS_HOURS_KEY } },
        create: { tenantId: actor.tenantId, key: BUSINESS_HOURS_KEY, value: stored },
        update: { value: stored },
      });
    }

    return { settings: await this.read(actor.tenantId) };
  }

  private async read(tenantId: string): Promise<TenantSettingValues> {
    const row = await this.prisma.tenantSetting.findUnique({
      where: { tenantId_key: { tenantId, key: BUSINESS_HOURS_KEY } },
    });
    if (!row) {
      return {};
    }

    return { business_hours: decodeBusinessHours(row.value) };
  }
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
