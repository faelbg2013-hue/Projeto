import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export class DashboardQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: '2026-09-29',
    description:
      'Dia civil em America/Sao_Paulo usado no resumo, na lista e na visão por profissional. Sem o parâmetro, a API usa a data de hoje nessa timezone. Os próximos atendimentos não ficam limitados a este dia.',
  })
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Restringe o dia e os próximos atendimentos a um profissional do tenant. Outro tenant responde 404. Os totais do estabelecimento não usam este filtro.',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({
    type: String,
    enum: STATUSES,
    description:
      'Filtra somente a lista de atendimentos do dia. O resumo, os próximos atendimentos e a visão por profissional não usam este filtro.',
  })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
