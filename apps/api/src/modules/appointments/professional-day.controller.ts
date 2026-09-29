import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser, type ProfessionalDay } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { queryPipe } from '../../common/validation/body.pipe';
import { ProfessionalDayQueryDto } from './dto/professional-day.query';
import { ProfessionalDayDto } from './dto/professional-day.response';
import { ProfessionalDayService } from './professional-day.service';

@ApiTags('professionals')
@ApiBearerAuth('bearer')
@Controller({ path: 'professionals/me/dashboard', version: '1' })
export class ProfessionalDayController {
  constructor(@Inject(ProfessionalDayService) private readonly day: ProfessionalDayService) {}

  @Get()
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'getMyProfessionalDashboard',
    summary: 'Resume o dia operacional do profissional autenticado',
    description:
      'Somente PROFESSIONAL. O tenant e o profissional vêm da sessão. A data é um dia civil em America/Sao_Paulo; se omitida, vale hoje nessa timezone. Uma consulta devolve o resumo, o próximo CONFIRMED futuro, o CONFIRMED em andamento e os agendamentos do dia. Não aceita professionalId. Não inclui caixa, comissão nem movimentação de pontos.',
  })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-09-29' })
  @ApiOkResponse({ type: ProfessionalDayDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  get(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(ProfessionalDayQueryDto)) query: ProfessionalDayQueryDto,
  ): Promise<ProfessionalDay> {
    return this.day.get(actor, query);
  }
}
