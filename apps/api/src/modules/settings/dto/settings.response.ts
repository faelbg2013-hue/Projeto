import { ApiProperty } from '@nestjs/swagger';
import type { TenantSettingValues, TenantSettingsResponse } from '@ravion/types';
import { TenantSettingValuesDto } from './update-settings.dto';

export class SettingsResponseDto implements TenantSettingsResponse {
  @ApiProperty({ type: TenantSettingValuesDto })
  settings!: TenantSettingValues;
}
