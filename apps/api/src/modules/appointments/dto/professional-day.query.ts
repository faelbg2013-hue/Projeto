import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ProfessionalDayQueryDto {
  @ApiPropertyOptional({
    type: String,
    example: '2026-09-29',
    description:
      'Dia civil em America/Sao_Paulo. Sem o parâmetro, a API usa a data de hoje nessa timezone. O profissional sai da sessão; professionalId enviado pelo cliente é rejeitado.',
  })
  @IsOptional()
  @Matches(DATE, { message: 'Data inválida.' })
  date?: string;
}
