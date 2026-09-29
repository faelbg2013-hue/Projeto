import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export class DashboardQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: '2026-09-29',
    description: 'Dia civil em America/Sao_Paulo. Sem o parâmetro, a API usa a data de hoje nessa timezone.',
  })
  @IsOptional()
  @Matches(DATE)
  date?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Restringe o dia a um profissional do tenant. Outro tenant responde 404.',
  })
  @IsOptional()
  @IsUUID()
  professionalId?: string;

  @ApiPropertyOptional({
    type: String,
    enum: STATUSES,
    description:
      'Filtra somente a lista de atendimentos do dia. O resumo, os próximos atendimentos e a visão por profissional continuam o dia inteiro.',
  })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];
}
