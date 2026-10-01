import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';

/** Objeto fechado. Propriedades desconhecidas são rejeitadas pelo pipe. */
export class TenantSettingValuesDto {}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: TenantSettingValuesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingValuesDto)
  settings?: TenantSettingValuesDto;
}
