import { Body, Controller, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
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
import { UserRole, type AuthUser, type ClientPointsSummary, type Paginated, type PointsAdjustmentResult, type PointsBalance, type PointsTransactionItem } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { PaginationQueryDto } from '../../common/dto/pagination.query';
import { bodyPipe, queryPipe } from '../../common/validation/body.pipe';
import { AdjustPointsDto } from './dto/points.dto';
import {
  ClientPointsSummaryDto,
  PaginatedPointsTransactionsDto,
  PointsAdjustmentResultDto,
  PointsBalanceDto,
} from './dto/points.response';
import { PointsService } from './points.service';

@ApiTags('points')
@ApiBearerAuth('bearer')
@Controller({ path: 'points', version: '1' })
export class PointsController {
  constructor(@Inject(PointsService) private readonly points: PointsService) {}

  @Get('me')
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    operationId: 'getMyPointsBalance',
    summary: 'Consulta o saldo de pontos do cliente autenticado',
    description:
      'Somente CLIENT. O cliente é a sessão. O saldo é a soma dos créditos menos a soma dos débitos do ledger. Não aceita clientId.',
  })
  @ApiOkResponse({ type: PointsBalanceDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  balance(@CurrentUser() actor: AuthUser): Promise<PointsBalance> {
    return this.points.balanceForMe(actor);
  }

  @Get('me/transactions')
  @Roles(UserRole.CLIENT)
  @ApiOperation({
    operationId: 'listMyPointsTransactions',
    summary: 'Lista o extrato de pontos do cliente autenticado',
    description: 'Somente CLIENT. Ordem createdAt descendente e id descendente. Não há edição nem exclusão.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedPointsTransactionsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(
    @CurrentUser() actor: AuthUser,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<PointsTransactionItem>> {
    return this.points.listMine(actor, query);
  }
}

@ApiTags('points')
@ApiBearerAuth('bearer')
@Controller({ path: 'clients', version: '1' })
export class ClientPointsController {
  constructor(@Inject(PointsService) private readonly points: PointsService) {}

  @Get(':id/points')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'getClientPoints',
    summary: 'Consulta o saldo de pontos de um cliente do tenant',
    description: 'Somente ADMIN. Cliente de outro tenant responde 404. O saldo vem do ledger.',
  })
  @ApiOkResponse({ type: ClientPointsSummaryDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  summary(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClientPointsSummary> {
    return this.points.summaryForClient(actor, id);
  }

  @Get(':id/points/transactions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    operationId: 'listClientPointsTransactions',
    summary: 'Lista o extrato de pontos de um cliente do tenant',
    description: 'Somente ADMIN. Cliente de outro tenant responde 404.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20 })
  @ApiOkResponse({ type: PaginatedPointsTransactionsDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  transactions(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(queryPipe(PaginationQueryDto)) query: PaginationQueryDto,
  ): Promise<Paginated<PointsTransactionItem>> {
    return this.points.listForClient(actor, id, query);
  }

  @Post(':id/points/adjustments')
  @Roles(UserRole.ADMIN)
  @HttpCode(201)
  @ApiOperation({
    operationId: 'adjustClientPoints',
    summary: 'Credita ou debita pontos de um cliente',
    description:
      'Somente ADMIN, somente ADJUSTMENT_CREDIT ou ADJUSTMENT_DEBIT. EARN, REDEEM e REDEEM_REVERSAL são rejeitados. O motivo é obrigatório. createdByUserId vem da sessão. O débito trava a linha do cliente e recusa saldo insuficiente com 409.',
  })
  @ApiCreatedResponse({ type: PointsAdjustmentResultDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto, description: 'Saldo de pontos insuficiente.' })
  adjust(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(AdjustPointsDto)) body: AdjustPointsDto,
  ): Promise<PointsAdjustmentResult> {
    return this.points.adjust(actor, id, body);
  }
}
