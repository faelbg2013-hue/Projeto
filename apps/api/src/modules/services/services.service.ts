import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Service } from '@prisma/client';
import { UserRole, type AuthUser, type Paginated, type ServiceItem } from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { pageMeta, pageWindow } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ActiveListQueryDto } from '../../common/dto/active-list.query';
import type { CreateServiceDto } from './dto/create-service.dto';
import type { UpdateServiceDto } from './dto/update-service.dto';

const NOT_FOUND = 'Recurso não encontrado';

function toService(service: Service): ServiceItem {
  return {
    id: service.id,
    tenantId: service.tenantId,
    name: service.name,
    description: service.description,
    price: service.price.toFixed(2),
    durationMinutes: service.durationMinutes,
    points: service.points,
    redemptionPoints: service.redemptionPoints,
    isActive: service.isActive,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

@Injectable()
export class ServicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(actor: AuthUser, query: ActiveListQueryDto): Promise<Paginated<ServiceItem>> {
    const window = pageWindow(query);
    const isActive = actor.role === UserRole.ADMIN ? query.isActive : true;
    const where = {
      tenantId: actor.tenantId,
      ...(isActive === undefined ? {} : { isActive }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.service.count({ where }),
    ]);
    return {
      data: rows.map((row) => toService(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async find(actor: AuthUser, serviceId: string): Promise<ServiceItem> {
    const service = await this.requireVisible(actor, serviceId);
    return toService(service);
  }

  async create(actor: AuthUser, input: CreateServiceDto): Promise<ServiceItem> {
    const service = await this.prisma.service.create({
      data: {
        tenantId: actor.tenantId,
        name: input.name,
        description: input.description ?? null,
        price: new Prisma.Decimal(input.price.toFixed(2)),
        durationMinutes: input.durationMinutes,
        points: input.points,
        redemptionPoints: input.redemptionPoints ?? null,
        isActive: true,
      },
    });
    return toService(service);
  }

  async update(actor: AuthUser, serviceId: string, input: UpdateServiceDto): Promise<ServiceItem> {
    await this.requireSameTenant(actor, serviceId);
    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price.toFixed(2)) } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.points !== undefined ? { points: input.points } : {}),
        ...(input.redemptionPoints !== undefined ? { redemptionPoints: input.redemptionPoints } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return toService(service);
  }

  async deactivate(actor: AuthUser, serviceId: string): Promise<ServiceItem> {
    await this.requireSameTenant(actor, serviceId);
    const service = await this.prisma.service.update({
      where: { id: serviceId },
      data: { isActive: false },
    });
    return toService(service);
  }

  private async requireVisible(actor: AuthUser, serviceId: string): Promise<Service> {
    const service = await this.requireSameTenant(actor, serviceId);
    if (actor.role !== UserRole.ADMIN && !service.isActive) {
      throw new NotFoundException(NOT_FOUND);
    }
    return service;
  }

  private async requireSameTenant(actor: AuthUser, serviceId: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, service.tenantId);
    return service;
  }
}
