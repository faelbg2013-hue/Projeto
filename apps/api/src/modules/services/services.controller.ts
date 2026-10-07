import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser, type Paginated, type ServiceItem } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import { AdminServiceQueryDto } from './dto/admin-service.query';
import { CreateServiceDto } from './dto/create-service.dto';
import { PaginatedServicesDto, ServiceResponseDto } from './dto/service.response';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServicesService } from './services.service';

@ApiTags('services')
@ApiBearerAuth('bearer')
@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(@Inject(ServicesService) private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({
    operationId: 'listServices',
    summary: 'Lista os serviços do tenant autenticado',
    description:
      'A mesma rota serve o catálogo operacional e a gestão. CLIENT e PROFESSIONAL recebem somente serviços ativos, ignoram search e continuam em createdAt descendente, para o agendamento não depender da paginação administrativa. ADMIN pode omitir isActive, filtrar ativos e inativos, e buscar um trecho do nome. Para o ADMIN, pageSize padrão 20, máximo 100, ordenação por nome e id. price é o valor comercial do serviço, não um pagamento. points é o ganho na conclusão. redemptionPoints null significa que o resgate não está disponível.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Padrão 20. Máximo 100.' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'ADMIN. Sem o parâmetro, ativos e inativos.' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'corte' })
  @ApiOkResponse({ type: PaginatedServicesDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(AdminServiceQueryDto)) query: AdminServiceQueryDto,
  ): Promise<Paginated<ServiceItem>> {
    return this.servicesService.list(actor, query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createService',
    summary: 'Cria um serviço no tenant autenticado',
    description:
      'Somente ADMIN. tenantId do corpo é rejeitado. O tenant vem da sessão. price é o valor comercial registrado, não um pagamento. points é o ganho na conclusão. redemptionPoints é o custo do resgate e pode ser null.',
  })
  @ApiBody({ type: CreateServiceDto })
  @ApiCreatedResponse({ type: ServiceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(CreateServiceDto)) body: CreateServiceDto,
  ): Promise<ServiceItem> {
    return this.servicesService.create(actor, body);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getService',
    summary: 'Consulta um serviço do tenant autenticado',
    description:
      'Outro tenant responde 404. Um serviço inativo também responde 404 para CLIENT e PROFESSIONAL.',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  find(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceItem> {
    return this.servicesService.find(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'updateService',
    summary: 'Atualiza um serviço do tenant autenticado',
    description:
      'Somente ADMIN. tenantId não faz parte do contrato e é rejeitado. redemptionPoints null desativa o resgate.',
  })
  @ApiBody({ type: UpdateServiceDto })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(UpdateServiceDto)) body: UpdateServiceDto,
  ): Promise<ServiceItem> {
    return this.servicesService.update(actor, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'deactivateService',
    summary: 'Desativa um serviço do tenant autenticado',
    description: 'Somente ADMIN. Não apaga o registro. A resposta traz isActive false.',
  })
  @ApiOkResponse({ type: ServiceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceItem> {
    return this.servicesService.deactivate(actor, id);
  }
}
