import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser, type ClientProfile, type Paginated } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ActiveListQueryDto } from '../../common/dto/active-list.query';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import { ClientsService } from './clients.service';
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
    description: 'Somente ADMIN. A ordenação é createdAt descendente.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiOkResponse({ type: PaginatedClientsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(ActiveListQueryDto)) query: ActiveListQueryDto,
  ): Promise<Paginated<ClientProfile>> {
    return this.clientsService.list(actor, query);
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
