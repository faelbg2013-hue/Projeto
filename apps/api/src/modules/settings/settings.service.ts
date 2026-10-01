import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser, TenantSettingValues, TenantSettingsResponse } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { TENANT_SETTING_KEYS, type TenantSettingKey } from './settings.constants';
import type { UpdateSettingsDto } from './dto/update-settings.dto';

function isSettingKey(key: string): key is TenantSettingKey {
  return (TENANT_SETTING_KEYS as readonly string[]).includes(key);
}

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(actor: AuthUser): Promise<TenantSettingsResponse> {
    return { settings: await this.read(actor.tenantId) };
  }

  async update(actor: AuthUser, body: UpdateSettingsDto): Promise<TenantSettingsResponse> {
    const entries = Object.entries(body.settings ?? {}).filter((entry): entry is [TenantSettingKey, string] =>
      isSettingKey(entry[0]),
    );

    if (entries.length > 0) {
      await this.prisma.$transaction(
        entries.map(([key, value]) =>
          this.prisma.tenantSetting.upsert({
            where: { tenantId_key: { tenantId: actor.tenantId, key } },
            create: { tenantId: actor.tenantId, key, value },
            update: { value },
          }),
        ),
      );
    }

    return { settings: await this.read(actor.tenantId) };
  }

  private async read(tenantId: string): Promise<TenantSettingValues> {
    const keys: readonly string[] = TENANT_SETTING_KEYS;
    if (keys.length === 0) {
      return {};
    }

    const rows = await this.prisma.tenantSetting.findMany({
      where: { tenantId, key: { in: [...keys] } },
    });
    const settings: Record<string, string> = {};
    for (const row of rows) {
      if (isSettingKey(row.key)) {
        settings[row.key] = row.value;
      }
    }
    return settings as TenantSettingValues;
  }
}
