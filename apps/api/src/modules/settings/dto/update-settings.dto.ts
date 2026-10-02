import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateIf,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { businessDayError } from '../business-hours';

const WALL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

@ValidatorConstraint({ name: 'businessHoursDay', async: false })
export class BusinessHoursDayRule implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return businessDayError(value) === null;
  }

  defaultMessage(args: ValidationArguments): string {
    return businessDayError(args.value) ?? 'Horário de funcionamento inválido.';
  }
}

export class BusinessHoursDayDto {
  @ApiProperty({ type: Boolean, example: true })
  @IsBoolean({ message: 'Informe se o dia está aberto.' })
  enabled!: boolean;

  @ApiProperty({ type: String, nullable: true, example: '08:00' })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString({ message: 'Horário inválido. Use HH:mm.' })
  @Matches(WALL_TIME, { message: 'Horário inválido. Use HH:mm.' })
  open!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '18:00' })
  @ValidateIf((_, value: unknown) => value !== null)
  @IsString({ message: 'Horário inválido. Use HH:mm.' })
  @Matches(WALL_TIME, { message: 'Horário inválido. Use HH:mm.' })
  close!: string | null;
}

export class BusinessHoursDto {
  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  monday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  tuesday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  wednesday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  thursday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  friday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  saturday!: BusinessHoursDayDto;

  @ApiProperty({ type: () => BusinessHoursDayDto })
  @IsDefined({ message: 'Informe o horário de todos os dias.' })
  @ValidateNested()
  @Type(() => BusinessHoursDayDto)
  @Validate(BusinessHoursDayRule)
  sunday!: BusinessHoursDayDto;
}

/** Objeto fechado. Propriedades desconhecidas são rejeitadas pelo pipe. */
export class TenantSettingValuesDto {
  @ApiPropertyOptional({ type: () => BusinessHoursDto })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  business_hours?: BusinessHoursDto;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: () => TenantSettingValuesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingValuesDto)
  settings?: TenantSettingValuesDto;
}
