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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type {
  AuthUser,
  Availability,
  Paginated,
  ProfessionalSchedule,
  ScheduleException,
  TimeBlock,
} from '@ravion/types';
import { UserRole } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import {
  AvailabilityQueryDto,
  CreateScheduleExceptionDto,
  CreateTimeBlockDto,
  ReplaceScheduleDto,
  UpdateScheduleExceptionDto,
} from './dto/schedule.dto';
import {
  AvailabilityResponseDto,
  PaginatedScheduleExceptionsDto,
  PaginatedTimeBlocksDto,
  ProfessionalScheduleResponseDto,
  ScheduleExceptionResponseDto,
  TimeBlockResponseDto,
} from './dto/schedule.response';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth('bearer')
@Controller({ path: 'professionals', version: '1' })
export class ScheduleController {
  constructor(@Inject(ScheduleService) private readonly scheduleService: ScheduleService) {}

  @Get('me/schedule')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'getMySchedule',
    summary: 'Consulta a agenda semanal do profissional autenticado',
    description:
      'Somente o próprio PROFESSIONAL. O tenant vem da sessão. A resposta traz os intervalos ativos, ordenados por dia e horário.',
  })
  @ApiOkResponse({ type: ProfessionalScheduleResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getMySchedule(@CurrentUser() actor: AuthUser): Promise<ProfessionalSchedule> {
    return this.scheduleService.getOwnSchedule(actor);
  }

  @Put('me/schedule')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'replaceMySchedule',
    summary: 'Substitui a agenda semanal do profissional autenticado',
    description:
      'Uma requisição substitui a semana inteira. Um dia ausente fica fechado. Vários intervalos no mesmo dia são permitidos. Intervalos inválidos ou sobrepostos são rejeitados antes de gravar. tenantId do corpo é ignorado e rejeitado.',
  })
  @ApiOkResponse({ type: ProfessionalScheduleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  replaceMySchedule(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(ReplaceScheduleDto)) body: ReplaceScheduleDto,
  ): Promise<ProfessionalSchedule> {
    return this.scheduleService.replaceOwnSchedule(actor, body);
  }

  @Get('me/time-blocks')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'listMyTimeBlocks',
    summary: 'Lista os bloqueios do profissional autenticado',
    description: 'Ordenação por startAt descendente. Envelope { data, meta }.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedTimeBlocksDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listMyTimeBlocks(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<TimeBlock>> {
    return this.scheduleService.listOwnBlocks(actor, query);
  }

  @Post('me/time-blocks')
  @Roles(UserRole.PROFESSIONAL)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createMyTimeBlock',
    summary: 'Cria um bloqueio do profissional autenticado',
    description:
      'Bloqueio é um instante com data e horário. Sem fuso no texto, o valor é America/Sao_Paulo. Sobreposição é rejeitada. Um dia inteiro pode ir de 00:00:00 a 23:59:59 no mesmo offset.',
  })
  @ApiCreatedResponse({ type: TimeBlockResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createMyTimeBlock(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(CreateTimeBlockDto)) body: CreateTimeBlockDto,
  ): Promise<TimeBlock> {
    return this.scheduleService.createOwnBlock(actor, body);
  }

  @Delete('me/time-blocks/:blockId')
  @Roles(UserRole.PROFESSIONAL)
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteMyTimeBlock',
    summary: 'Remove um bloqueio do profissional autenticado',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteMyTimeBlock(
    @CurrentUser() actor: AuthUser,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ): Promise<void> {
    return this.scheduleService.deleteOwnBlock(actor, blockId);
  }

  @Get('me/exceptions')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'listMyScheduleExceptions',
    summary: 'Lista as exceções de agenda do profissional autenticado',
    description: 'OPEN abre um período fora da semana. BLOCK remove um período. Ordenação por data descendente.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedScheduleExceptionsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  listMyScheduleExceptions(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<ScheduleException>> {
    return this.scheduleService.listOwnExceptions(actor, query);
  }

  @Post('me/exceptions')
  @Roles(UserRole.PROFESSIONAL)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createMyScheduleException',
    summary: 'Cria uma exceção de agenda do profissional autenticado',
    description:
      'startTime e endTime nulos, ou omitidos, representam o dia inteiro. Os dois horários precisam vir juntos. Sobreposição no mesmo dia é rejeitada.',
  })
  @ApiCreatedResponse({ type: ScheduleExceptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  createMyScheduleException(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(CreateScheduleExceptionDto)) body: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.scheduleService.createOwnException(actor, body);
  }

  @Patch('me/exceptions/:exceptionId')
  @Roles(UserRole.PROFESSIONAL)
  @ApiOperation({
    operationId: 'updateMyScheduleException',
    summary: 'Altera uma exceção de agenda do profissional autenticado',
  })
  @ApiOkResponse({ type: ScheduleExceptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateMyScheduleException(
    @CurrentUser() actor: AuthUser,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body(bodyPipe(UpdateScheduleExceptionDto)) body: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.scheduleService.updateOwnException(actor, exceptionId, body);
  }

  @Delete('me/exceptions/:exceptionId')
  @Roles(UserRole.PROFESSIONAL)
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteMyScheduleException',
    summary: 'Remove uma exceção de agenda do profissional autenticado',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteMyScheduleException(
    @CurrentUser() actor: AuthUser,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<void> {
    return this.scheduleService.deleteOwnException(actor, exceptionId);
  }

  @Get(':id/schedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getProfessionalSchedule',
    summary: 'Consulta a agenda semanal de um profissional do tenant',
    description: 'Somente ADMIN do mesmo tenant. Outro tenant responde 404.',
  })
  @ApiOkResponse({ type: ProfessionalScheduleResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getProfessionalSchedule(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProfessionalSchedule> {
    return this.scheduleService.getSchedule(actor, id);
  }

  @Put(':id/schedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'replaceProfessionalSchedule',
    summary: 'Substitui a agenda semanal de um profissional do tenant',
    description: 'Somente ADMIN. A validação é a mesma da agenda própria. Profissional inativo ainda pode ser configurado.',
  })
  @ApiOkResponse({ type: ProfessionalScheduleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  replaceProfessionalSchedule(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(ReplaceScheduleDto)) body: ReplaceScheduleDto,
  ): Promise<ProfessionalSchedule> {
    return this.scheduleService.replaceScheduleFor(actor, id, body);
  }

  @Get(':id/time-blocks')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listProfessionalTimeBlocks',
    summary: 'Lista os bloqueios de um profissional do tenant',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedTimeBlocksDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  listProfessionalTimeBlocks(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<TimeBlock>> {
    return this.scheduleService.listBlocksFor(actor, id, query);
  }

  @Post(':id/time-blocks')
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createProfessionalTimeBlock',
    summary: 'Cria um bloqueio para um profissional do tenant',
  })
  @ApiCreatedResponse({ type: TimeBlockResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createProfessionalTimeBlock(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(CreateTimeBlockDto)) body: CreateTimeBlockDto,
  ): Promise<TimeBlock> {
    return this.scheduleService.createBlockFor(actor, id, body);
  }

  @Delete(':id/time-blocks/:blockId')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteProfessionalTimeBlock',
    summary: 'Remove um bloqueio de um profissional do tenant',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteProfessionalTimeBlock(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
  ): Promise<void> {
    return this.scheduleService.deleteBlockFor(actor, id, blockId);
  }

  @Get(':id/exceptions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listProfessionalScheduleExceptions',
    summary: 'Lista as exceções de um profissional do tenant',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedScheduleExceptionsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  listProfessionalScheduleExceptions(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<ScheduleException>> {
    return this.scheduleService.listExceptionsFor(actor, id, query);
  }

  @Post(':id/exceptions')
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'createProfessionalScheduleException',
    summary: 'Cria uma exceção para um profissional do tenant',
  })
  @ApiCreatedResponse({ type: ScheduleExceptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  createProfessionalScheduleException(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(CreateScheduleExceptionDto)) body: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.scheduleService.createExceptionFor(actor, id, body);
  }

  @Patch(':id/exceptions/:exceptionId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'updateProfessionalScheduleException',
    summary: 'Altera uma exceção de um profissional do tenant',
  })
  @ApiOkResponse({ type: ScheduleExceptionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  updateProfessionalScheduleException(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
    @Body(bodyPipe(UpdateScheduleExceptionDto)) body: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.scheduleService.updateExceptionFor(actor, id, exceptionId, body);
  }

  @Delete(':id/exceptions/:exceptionId')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteProfessionalScheduleException',
    summary: 'Remove uma exceção de um profissional do tenant',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  deleteProfessionalScheduleException(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<void> {
    return this.scheduleService.deleteExceptionFor(actor, id, exceptionId);
  }

  @Get(':id/availability')
  @ApiOperation({
    operationId: 'getProfessionalAvailability',
    summary: 'Consulta os horários de início disponíveis em uma data',
    description:
      'CLIENT, PROFESSIONAL e ADMIN do mesmo tenant. Uma data por requisição, no formato YYYY-MM-DD, em America/Sao_Paulo. Os inícios continuam de 15 minutos e o serviço precisa terminar dentro da interseção entre a jornada do profissional e o business_hours do tenant, quando essa configuração existir. Sem business_hours, vale só a jornada do profissional. booking_min_advance_minutes, quando maior que zero, omite inícios anteriores a agora mais essa antecedência, sem arredondar o relógio. 0 preserva a grade atual. Profissional ou serviço de outro tenant, inativo ou inexistente responde 404. Data passada responde 200 com slots vazios. Não cria reserva.',
  })
  @ApiQuery({ name: 'date', required: true, type: String, example: '2026-10-05' })
  @ApiQuery({ name: 'serviceId', required: true, type: String })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  getProfessionalAvailability(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(queryPipe(AvailabilityQueryDto)) query: AvailabilityQueryDto,
  ): Promise<Availability> {
    return this.scheduleService.getAvailability(actor, id, query);
  }
}
