import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
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
import { UserRole, type AdminClientDetail, type AuthUser, type ClientProfile, type Paginated } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import { ClientsService } from './clients.service';
import { AdminClientQueryDto } from './dto/admin-client.query';
import { AdminClientDetailDto } from './dto/admin-client.response';
import { ClientResponseDto, PaginatedClientsDto } from './dto/client.response';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('clients')
@ApiBearerAuth('bearer')
@Controller({ path: 'clients', version: '1' })
export class ClientsController {
  constructor(@Inject(ClientsService) private readonly clientsService: ClientsService) {}

  @Get('me')
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    operationId: 'getMyClient',
    summary: 'Consulta o perfil operacional do cliente autenticado',
    description: 'Somente CLIENT. Não aceita o identificador de outro cliente.',
  })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findMine(@CurrentUser() actor: AuthUser): Promise<ClientProfile> {
    return this.clientsService.findMine(actor);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listClients',
    summary: 'Lista os clientes do tenant autenticado',
    description:
      'Somente ADMIN. O tenant vem da sessão. search compara um trecho do nome ou do e-mail. pageSize padrão 20, máximo 100. Ordenação por nome crescente e id crescente.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Padrão 20. Máximo 100.' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'rafael' })
  @ApiOkResponse({ type: PaginatedClientsDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(AdminClientQueryDto)) query: AdminClientQueryDto,
  ): Promise<Paginated<ClientProfile>> {
    return this.clientsService.list(actor, query);
  }

  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getAdminClientOverview',
    summary: 'Consulta a visão operacional de um cliente do tenant',
    description:
      'Somente ADMIN. Outro tenant ou cliente inexistente responde 404. O saldo é a soma do ledger. Próximos são até 5 PENDING ou CONFIRMED com início futuro, do mais próximo ao mais distante. O histórico traz até 5 COMPLETED, CANCELLED ou NO_SHOW, do mais recente ao mais antigo. As movimentações recentes são as últimas 5 do ledger.',
  })
  @ApiOkResponse({ type: AdminClientDetailDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  overview(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminClientDetail> {
    return this.clientsService.overview(actor, id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getClient',
    summary: 'Consulta um cliente do tenant autenticado',
    description: 'Somente ADMIN. CLIENT não usa esta rota. Outro tenant responde 404.',
  })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  find(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientProfile> {
    return this.clientsService.find(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'updateClient',
    summary: 'Ativa ou desativa um cliente do tenant autenticado',
    description:
      'Somente ADMIN. Não apaga o cliente. Nome, e-mail, senha e tenantId não fazem parte deste corpo.',
  })
  @ApiOkResponse({ type: ClientResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(UpdateClientDto)) body: UpdateClientDto,
  ): Promise<ClientProfile> {
    return this.clientsService.update(actor, id, body);
  }
}
