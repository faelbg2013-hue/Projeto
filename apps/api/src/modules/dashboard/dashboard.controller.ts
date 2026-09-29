import { Controller, Get, Inject, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser, type OperationalDashboard } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { queryPipe } from '../../common/validation/body.pipe';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard.query';
import { DashboardResponseDto } from './dto/dashboard.response';

@ApiTags('dashboard')
@ApiBearerAuth('bearer')
@Controller({ path: 'admin/dashboard', version: '1' })
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getAdminDashboard',
    summary: 'Resume a operação de um dia civil',
    description:
      'Somente ADMIN. O tenant vem da sessão. A data é um dia civil em America/Sao_Paulo; se omitida, vale hoje nessa timezone. professionalId de outro tenant responde 404. O status filtra apenas a lista de atendimentos. O resumo soma priceSnapshot e os lançamentos REDEEM, REDEEM_REVERSAL e EARN ligados aos agendamentos do dia. O valor dos serviços não é pagamento.',
  })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-09-29' })
  @ApiQuery({ name: 'professionalId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiOkResponse({ type: DashboardResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  get(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(DashboardQueryDto)) query: DashboardQueryDto,
  ): Promise<OperationalDashboard> {
    return this.dashboard.get(actor, query);
  }
}
