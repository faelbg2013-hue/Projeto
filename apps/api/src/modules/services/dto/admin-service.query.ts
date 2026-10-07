import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ActiveListQueryDto } from '../../../common/dto/active-list.query';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export class AdminServiceQueryDto extends ActiveListQueryDto {
  @ApiPropertyOptional({
    type: String,
    maxLength: 80,
    description:
      'Trecho do nome do serviço, usado na gestão do ADMIN. CLIENT e PROFESSIONAL ignoram este parâmetro e continuam recebendo somente ativos.',
    example: 'corte',
  })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}
