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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  UserRole,
  type AdminProfessionalDetail,
  type AuthUser,
  type BookableProfessional,
  type Paginated,
  type ProfessionalProfile,
} from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import { AdminProfessionalQueryDto } from './dto/admin-professional.query';
import { AdminProfessionalDetailDto } from './dto/admin-professional.response';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import {
  PaginatedBookableProfessionalsDto,
  PaginatedProfessionalsDto,
  ProfessionalResponseDto,
} from './dto/professional.response';
import { UpdateProfessionalDto } from './dto/update-professional.dto';
import { ProfessionalsService } from './professionals.service';

@ApiTags('professionals')
@ApiBearerAuth('bearer')
@Controller({ path: 'professionals', version: '1' })
export class ProfessionalsController {
  constructor(
    @Inject(ProfessionalsService) private readonly professionalsService: ProfessionalsService,
  ) {}

  @Get('me')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'getMyProfessional',
    summary: 'Consulta o perfil operacional do profissional autenticado',
    description: 'Somente PROFESSIONAL. Não lista outros profissionais.',
  })
  @ApiOkResponse({ type: ProfessionalResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  findMine(@CurrentUser() actor: AuthUser): Promise<ProfessionalProfile> {
    return this.professionalsService.findMine(actor);
  }

  @Get('bookable')
  @Roles(UserRole.CLIENT, UserRole.PROFESSIONAL, UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listBookableProfessionals',
    summary: 'Lista profissionais ativos para agendamento',
    description: 'CLIENT, PROFESSIONAL e ADMIN. Só o id e o nome de exibição. Sem e-mail e sem senha.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedBookableProfessionalsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  listBookable(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<BookableProfessional>> {
    return this.professionalsService.listBookable(actor, query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listProfessionals',
    summary: 'Lista os profissionais do tenant autenticado',
    description:
      'Somente ADMIN. O tenant vem da sessão. search compara um trecho do nome de exibição, do nome da conta ou do e-mail. isActive filtra a situação existente. pageSize padrão 20, máximo 100. Ordenação por nome de exibição crescente e id crescente.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Padrão 20. Máximo 100.' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: 'Sem o parâmetro, ativos e inativos.' })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'rafael' })
  @ApiOkResponse({ type: PaginatedProfessionalsDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(AdminProfessionalQueryDto)) query: AdminProfessionalQueryDto,
  ): Promise<Paginated<ProfessionalProfile>> {
    return this.professionalsService.list(actor, query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createProfessional',
    summary: 'Cria um usuário PROFESSIONAL e o perfil operacional',
    description:
      'Somente ADMIN. O cadastro público não cria profissional. Papel, tenantId e userId do corpo são rejeitados. User e Professional nascem na mesma transação.',
  })
  @ApiCreatedResponse({ type: ProfessionalResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(CreateProfessionalDto)) body: CreateProfessionalDto,
  ): Promise<ProfessionalProfile> {
    return this.professionalsService.create(actor, body);
  }

  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getAdminProfessionalOverview',
    summary: 'Consulta a visão operacional de um profissional do tenant',
    description:
      'Somente ADMIN. Outro tenant ou profissional inexistente responde 404. PROFESSIONAL não consulta esta rota, mesmo o próprio registro. Serviços são o catálogo do tenant, sem vínculo individual. A jornada lista só intervalos ativos da agenda semanal. Hoje é o dia civil em America/Sao_Paulo. Próximos são até 5 PENDING ou CONFIRMED com início futuro. O histórico traz até 5 COMPLETED, CANCELLED ou NO_SHOW. Totais de status são o histórico do profissional. O nome do serviço nos atendimentos é o snapshot.',
  })
  @ApiOkResponse({ type: AdminProfessionalDetailDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  overview(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdminProfessionalDetail> {
    return this.professionalsService.overview(actor, id);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getProfessional',
    summary: 'Consulta um profissional do tenant autenticado',
    description: 'Somente ADMIN. Outro tenant responde 404.',
  })
  @ApiOkResponse({ type: ProfessionalResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  find(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfessionalProfile> {
    return this.professionalsService.find(actor, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'updateProfessional',
    summary: 'Atualiza nome de exibição ou status do profissional',
    description: 'Somente ADMIN. E-mail, senha e tenantId não fazem parte deste corpo.',
  })
  @ApiOkResponse({ type: ProfessionalResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(UpdateProfessionalDto)) body: UpdateProfessionalDto,
  ): Promise<ProfessionalProfile> {
    return this.professionalsService.update(actor, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'deactivateProfessional',
    summary: 'Desativa um profissional do tenant autenticado',
    description: 'Somente ADMIN. Não apaga o registro. A resposta traz isActive false.',
  })
  @ApiOkResponse({ type: ProfessionalResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deactivate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfessionalProfile> {
    return this.professionalsService.deactivate(actor, id);
  }
}
