import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointsTransactionType, Prisma } from '@prisma/client';
import type {
  AuthUser,
  ClientPointsSummary,
  Paginated,
  PointsAdjustmentResult,
  PointsBalance,
  PointsTransactionItem,
} from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { pageMeta, pageWindow } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AdjustPointsDto } from './dto/points.dto';

const NOT_FOUND = 'Recurso não encontrado';
const INSUFFICIENT = 'Saldo de pontos insuficiente.';
const BUSY = 'Não foi possível concluir a movimentação de pontos.';
const CREDIT_TYPES = new Set<PointsTransactionType>([
  PointsTransactionType.EARN,
  PointsTransactionType.ADJUSTMENT_CREDIT,
]);

const transactionInclude = {
  appointment: { select: { serviceNameSnapshot: true } },
} satisfies Prisma.PointsTransactionInclude;

type TransactionRow = Prisma.PointsTransactionGetPayload<{ include: typeof transactionInclude }>;
type PointsReader = Prisma.TransactionClient | PrismaService;

function toTransaction(row: TransactionRow): PointsTransactionItem {
  return {
    id: row.id,
    type: row.type,
    points: row.points,
    reason: row.reason,
    appointmentId: row.appointmentId,
    serviceName: row.appointment?.serviceNameSnapshot ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function isConcurrencyError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2028' || error.code === 'P2034';
  }
  const message = error instanceof Error ? error.message : '';
  return (
    message.includes('Lock wait timeout') ||
    message.includes('Deadlock') ||
    message.includes('Transaction already closed') ||
    message.includes('Transaction API error')
  );
}

@Injectable()
export class PointsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordEarn(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string;
      clientId: string;
      appointmentId: string;
      points: number;
      serviceName: string;
      createdByUserId: string;
    },
  ): Promise<void> {
    if (input.points === 0) {
      return;
    }
    if (input.points < 0) {
      throw new BadRequestException('Quantidade de pontos inválida.');
    }
    const reason = `Atendimento concluído: ${input.serviceName}`.slice(0, 240);
    await tx.pointsTransaction.create({
      data: {
        tenantId: input.tenantId,
        clientId: input.clientId,
        type: PointsTransactionType.EARN,
        points: input.points,
        reason,
        appointmentId: input.appointmentId,
        earnAppointmentId: input.appointmentId,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  async balanceForMe(actor: AuthUser): Promise<PointsBalance> {
    const client = await this.requireOwnClient(actor);
    const summary = await this.totals(this.prisma, actor.tenantId, client.id);
    return { balance: summary.balance };
  }

  async listMine(
    actor: AuthUser,
    query: { page?: number; pageSize?: number },
  ): Promise<Paginated<PointsTransactionItem>> {
    const client = await this.requireOwnClient(actor);
    return this.list(actor.tenantId, client.id, query);
  }

  async summaryForClient(actor: AuthUser, clientId: string): Promise<ClientPointsSummary> {
    await this.requireTenantClient(actor.tenantId, clientId);
    const summary = await this.totals(this.prisma, actor.tenantId, clientId);
    const last = await this.prisma.pointsTransaction.findFirst({
      where: { tenantId: actor.tenantId, clientId },
      include: transactionInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return {
      clientId,
      balance: summary.balance,
      credits: summary.credits,
      debits: summary.debits,
      lastTransaction: last ? toTransaction(last) : null,
    };
  }

  async listForClient(
    actor: AuthUser,
    clientId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<Paginated<PointsTransactionItem>> {
    await this.requireTenantClient(actor.tenantId, clientId);
    return this.list(actor.tenantId, clientId, query);
  }

  async adjust(actor: AuthUser, clientId: string, input: AdjustPointsDto): Promise<PointsAdjustmentResult> {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Informe o motivo do ajuste.');
    }
    await this.requireTenantClient(actor.tenantId, clientId);
    const debit = input.type === 'ADJUSTMENT_DEBIT';

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const locked = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM clients WHERE id = ${clientId} AND tenantId = ${actor.tenantId} FOR UPDATE
          `;
          if (locked.length === 0) {
            throw new NotFoundException(NOT_FOUND);
          }
          const summary = await this.totals(tx, actor.tenantId, clientId);
          if (debit && summary.balance < input.points) {
            throw new ConflictException(INSUFFICIENT);
          }
          const row = await tx.pointsTransaction.create({
            data: {
              tenantId: actor.tenantId,
              clientId,
              type: input.type,
              points: input.points,
              reason,
              createdByUserId: actor.id,
            },
            include: transactionInclude,
          });
          const after = await this.totals(tx, actor.tenantId, clientId);
          return { balance: after.balance, transaction: toTransaction(row) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (isConcurrencyError(error)) {
        throw new ConflictException(BUSY);
      }
      throw error;
    }
  }

  private async list(
    tenantId: string,
    clientId: string,
    query: { page?: number; pageSize?: number },
  ): Promise<Paginated<PointsTransactionItem>> {
    const window = pageWindow(query);
    const where = { tenantId, clientId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.pointsTransaction.findMany({
        where,
        include: transactionInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.pointsTransaction.count({ where }),
    ]);
    return {
      data: rows.map((row) => toTransaction(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  private async totals(
    db: PointsReader,
    tenantId: string,
    clientId: string,
  ): Promise<{ balance: number; credits: number; debits: number }> {
    const grouped = await db.pointsTransaction.groupBy({
      by: ['type'],
      where: { tenantId, clientId },
      _sum: { points: true },
    });
    let credits = 0;
    let debits = 0;
    for (const row of grouped) {
      const amount = row._sum.points ?? 0;
      if (CREDIT_TYPES.has(row.type)) {
        credits += amount;
      } else {
        debits += amount;
      }
    }
    return { balance: credits - debits, credits, debits };
  }

  private async requireOwnClient(actor: AuthUser): Promise<{ id: string }> {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.id } });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    return client;
  }

  private async requireTenantClient(tenantId: string, clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(tenantId, client.tenantId);
  }
}
