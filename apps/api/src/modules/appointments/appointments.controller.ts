import {
  Body,
  Controller,
  Get,
  Headers,
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
  ApiBody,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AppointmentItem, type AuthUser, type Paginated } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import {
  AdminAppointmentQueryDto,
  AppointmentMeQueryDto,
  CreateAppointmentDto,
  ProfessionalAppointmentQueryDto,
} from './dto/appointment.dto';
import { AppointmentResponseDto, PaginatedAppointmentsDto } from './dto/appointment.response';
import { AppointmentsService } from './appointments.service';

@ApiTags('appointments')
@ApiBearerAuth('bearer')
@Controller({ path: 'appointments', version: '1' })
export class AppointmentsController {
  constructor(@Inject(AppointmentsService) private readonly appointments: AppointmentsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createAppointment',
    summary: 'Cria um agendamento confirmado para o cliente autenticado',
    description:
      'Somente CLIENT, sempre para o próprio cliente. clientId, tenantId, status, preço, duração, pontos, redemptionPointsSnapshot e newBalance são rejeitados. bookingMode POINTS relê o serviço, trava a linha do cliente e a do profissional, e cria o agendamento junto com um REDEEM. Saldo insuficiente, horário ocupado ou intervalo appointment_buffer_minutes insuficiente responde 409 e não grava nenhum dos dois. A antecedência mínima e a janela booking_max_advance_days são relidas na transação: um início anterior a agora mais booking_min_advance_minutes, ou uma data local posterior a hoje mais booking_max_advance_days, responde 409, o mesmo conflito de horário indisponível. A data limite é permitida. Nenhum dos dois casos grava appointment nem REDEEM. Idempotency-Key repetida não gera outro resgate. O preço em reais não é um pagamento.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: '8 a 80 caracteres [A-Za-z0-9_-]. O mesmo corpo devolve o agendamento já criado.',
  })
  @ApiBody({ type: CreateAppointmentDto })
  @ApiCreatedResponse({ type: AppointmentResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({
    type: ApiErrorResponseDto,
    description: 'Horário indisponível ou saldo de pontos insuficiente.',
  })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(CreateAppointmentDto)) body: CreateAppointmentDto,
    @Headers('idempotency-key') idempotencyKey?: string | string[],
  ): Promise<AppointmentItem> {
    const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
    return this.appointments.create(actor, body, key);
  }

  @Get('me')
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    operationId: 'listMyAppointments',
    summary: 'Lista os agendamentos do cliente autenticado',
    description: 'view=upcoming devolve CONFIRMED. view=history devolve COMPLETED, CANCELLED e NO_SHOW. Ordenação por startAt ascendente.',
  })
  @ApiQuery({ name: 'view', required: false, enum: ['upcoming', 'history'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedAppointmentsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listMine(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(AppointmentMeQueryDto)) query: AppointmentMeQueryDto,
  ): Promise<Paginated<AppointmentItem>> {
    return this.appointments.listMine(actor, query);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listAppointments',
    summary: 'Lista os agendamentos do tenant autenticado',
    description:
      'Somente ADMIN. O tenant vem da sessão. professionalId, clientId e serviceId de outro tenant respondem 404. serviceId é o serviço vinculado; o nome exibido permanece o snapshot. O período usa startAt em dias civis de America/Sao_Paulo, no máximo 90 dias, e exige início e fim. status aceita PENDING, CONFIRMED, COMPLETED, CANCELLED e NO_SHOW. bookingMode filtra NORMAL ou POINTS já gravados. clientName busca um trecho do nome no tenant. pageSize padrão 20, máximo 100. Ordenação por startAt descendente. O preço é o valor comercial do snapshot, não um pagamento.',
  })
  @ApiQuery({ name: 'professionalId', required: false, type: String })
  @ApiQuery({ name: 'clientId', required: false, type: String })
  @ApiQuery({ name: 'serviceId', required: false, type: String, description: 'Serviço vinculado. O nome da resposta é o snapshot.' })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Início inclusivo. Exige endDate. Máximo de 90 dias.' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Fim inclusivo. Exige startDate.' })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] })
  @ApiQuery({ name: 'clientName', required: false, type: String })
  @ApiQuery({ name: 'bookingMode', required: false, enum: ['NORMAL', 'POINTS'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Padrão 20. Máximo 100.' })
  @ApiOkResponse({ type: PaginatedAppointmentsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(AdminAppointmentQueryDto)) query: AdminAppointmentQueryDto,
  ): Promise<Paginated<AppointmentItem>> {
    return this.appointments.listForAdmin(actor, query);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getAppointment',
    summary: 'Consulta um agendamento visível para o usuário autenticado',
    description:
      'CLIENT vê o próprio. PROFESSIONAL vê os vinculados a ele. ADMIN vê o tenant. Outro tenant ou outro dono responde 404.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  find(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentItem> {
    return this.appointments.find(actor, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({
    operationId: 'cancelAppointment',
    summary: 'Cancela um agendamento confirmado',
    description:
      'CLIENT cancela o próprio. PROFESSIONAL cancela os vinculados a ele. ADMIN cancela no tenant. Só CONFIRMED pode ser cancelado. cancellation_min_advance_minutes, quando maior que zero, impede só o CLIENT de cancelar se o início for anterior a agora mais essa antecedência, em America/Sao_Paulo, e responde 409 sem alterar o agendamento nem o ledger. ADMIN e PROFESSIONAL não passam por essa antecedência. Se bookingMode for POINTS e o cancelamento for aceito, a mesma transação cria um único REDEEM_REVERSAL com os pontos do resgate original. NO_SHOW não devolve pontos. Uma segunda chamada não devolve de novo.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  cancel(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentItem> {
    return this.appointments.cancel(actor, id);
  }

  @Patch(':id/complete')
  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @ApiOperation({
    operationId: 'completeAppointment',
    summary: 'Marca o atendimento como realizado',
    description:
      'PROFESSIONAL do atendimento ou ADMIN. Preenche completedAt e, na mesma transação, gera um único EARN com os pontos do agendamento. Serviço com zero pontos não cria movimentação. Uma segunda conclusão não gera outro crédito.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  complete(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentItem> {
    return this.appointments.complete(actor, id);
  }

  @Patch(':id/no-show')
  @Roles(UserRole.PROFESSIONAL, UserRole.ADMIN)
  @ApiOperation({
    operationId: 'markAppointmentNoShow',
    summary: 'Marca falta do cliente',
    description: 'PROFESSIONAL do atendimento ou ADMIN. O registro permanece e continua ocupando o horário histórico.',
  })
  @ApiOkResponse({ type: AppointmentResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  markNoShow(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppointmentItem> {
    return this.appointments.markNoShow(actor, id);
  }
}

@Controller({ path: 'professionals/me/appointments', version: '1' })
@ApiTags('appointments')
@ApiBearerAuth('bearer')
export class ProfessionalAppointmentsController {
  constructor(@Inject(AppointmentsService) private readonly appointments: AppointmentsService) {}

  @Get()
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'listMyProfessionalAppointments',
    summary: 'Lista os agendamentos do profissional autenticado',
    description: 'Filtros opcionais de data civil e status. Ordenação por startAt ascendente.',
  })
  @ApiQuery({ name: 'date', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ type: PaginatedAppointmentsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(ProfessionalAppointmentQueryDto)) query: ProfessionalAppointmentQueryDto,
  ): Promise<Paginated<AppointmentItem>> {
    return this.appointments.listForProfessional(actor, query);
  }
}
