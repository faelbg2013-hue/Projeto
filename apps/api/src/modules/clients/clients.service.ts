import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser, ClientProfile, Paginated } from '@ravion/types';
import { UserRole } from '@ravion/types';
import { operationalUserSelect, toOperationalUser } from '../../common/auth/operational-user';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import type { ActiveListQueryDto } from '../../common/dto/active-list.query';
import { pageMeta, pageWindow } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { UpdateClientDto } from './dto/update-client.dto';

const NOT_FOUND = 'Recurso não encontrado';

type ClientRow = {
  id: string;
  tenantId: string;
  userId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthUser['role'];
    isActive: boolean;
  };
};

function toClient(client: ClientRow): ClientProfile {
  return {
    id: client.id,
    tenantId: client.tenantId,
    userId: client.userId,
    isActive: client.isActive,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
    user: toOperationalUser(client.user),
  };
}

@Injectable()
export class ClientsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: ActiveListQueryDto): Promise<Paginated<ClientProfile>> {
    const window = pageWindow(query);
    const where = {
      tenantId: actor.tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        include: { user: { select: operationalUserSelect } },
        orderBy: { createdAt: 'desc' },
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.client.count({ where }),
    ]);
    return {
      data: rows.map((row) => toClient(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async findMine(actor: AuthUser): Promise<ClientProfile> {
    const client = await this.prisma.client.findUnique({
      where: { userId: actor.id },
      include: { user: { select: operationalUserSelect } },
    });
    if (!client || client.user.role !== UserRole.CLIENT) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    return toClient(client);
  }

  async find(actor: AuthUser, clientId: string): Promise<ClientProfile> {
    return toClient(await this.requireSameTenant(actor, clientId));
  }

  async update(actor: AuthUser, clientId: string, input: UpdateClientDto): Promise<ClientProfile> {
    await this.requireSameTenant(actor, clientId);
    const client = await this.prisma.client.update({
      where: { id: clientId },
      data: {
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { user: { select: operationalUserSelect } },
    });
    return toClient(client);
  }

  private async requireSameTenant(actor: AuthUser, clientId: string): Promise<ClientRow> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { user: { select: operationalUserSelect } },
    });
    if (!client) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, client.tenantId);
    return client;
  }
}
