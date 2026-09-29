import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQueryDto } from './pagination.query';

function parseOptionalBoolean({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return value;
}

export class ActiveListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filtra pelo status operacional. Sem o parâmetro, o ADMIN recebe ativos e inativos. CLIENT e PROFESSIONAL sempre recebem somente serviços ativos.',
  })
  @Transform(parseOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
