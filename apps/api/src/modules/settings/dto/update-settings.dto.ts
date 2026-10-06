import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  type ValidationArguments,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { ADVANCE_MAX_MINUTES } from '../advance-policy';
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

const ADVANCE_INTEGER = 'A antecedência precisa ser um número inteiro de minutos.';
const ADVANCE_NEGATIVE = 'A antecedência não pode ser negativa.';
const ADVANCE_MAX = 'A antecedência máxima é de 43200 minutos.';

/** Objeto fechado. Propriedades desconhecidas são rejeitadas pelo pipe. */
export class TenantSettingValuesDto {
  @ApiPropertyOptional({ type: () => BusinessHoursDto })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  business_hours?: BusinessHoursDto;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: ADVANCE_MAX_MINUTES,
    example: 0,
    description:
      'Minutos inteiros antes do início para um horário poder ser agendado. 0 não acrescenta restrição. A leitura devolve 0 quando a linha ainda não existe.',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt({ message: ADVANCE_INTEGER })
  @Min(0, { message: ADVANCE_NEGATIVE })
  @Max(ADVANCE_MAX_MINUTES, { message: ADVANCE_MAX })
  booking_min_advance_minutes?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: ADVANCE_MAX_MINUTES,
    example: 0,
    description:
      'Minutos inteiros antes do início para o CLIENT cancelar. 0 não acrescenta restrição. Não se aplica a ADMIN nem PROFESSIONAL. A leitura devolve 0 quando a linha ainda não existe.',
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt({ message: ADVANCE_INTEGER })
  @Min(0, { message: ADVANCE_NEGATIVE })
  @Max(ADVANCE_MAX_MINUTES, { message: ADVANCE_MAX })
  cancellation_min_advance_minutes?: number;
}

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: () => TenantSettingValuesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TenantSettingValuesDto)
  settings?: TenantSettingValuesDto;
}
