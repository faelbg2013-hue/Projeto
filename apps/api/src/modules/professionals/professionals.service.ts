import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser, BookableProfessional, Paginated, ProfessionalProfile } from '@ravion/types';
import { UserRole } from '@ravion/types';
import { operationalUserSelect, toOperationalUser } from '../../common/auth/operational-user';
import { PasswordService } from '../../common/auth/password.service';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import type { ActiveListQueryDto } from '../../common/dto/active-list.query';
import { pageMeta, pageWindow } from '../../common/pagination';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { CreateProfessionalDto } from './dto/create-professional.dto';
import type { UpdateProfessionalDto } from './dto/update-professional.dto';

const NOT_FOUND = 'Recurso não encontrado';

type ProfessionalRow = {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
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

function toProfessional(professional: ProfessionalRow): ProfessionalProfile {
  return {
    id: professional.id,
    tenantId: professional.tenantId,
    userId: professional.userId,
    displayName: professional.displayName,
    isActive: professional.isActive,
    createdAt: professional.createdAt.toISOString(),
    updatedAt: professional.updatedAt.toISOString(),
    user: toOperationalUser(professional.user),
  };
}

@Injectable()
export class ProfessionalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async list(actor: AuthUser, query: ActiveListQueryDto): Promise<Paginated<ProfessionalProfile>> {
    const window = pageWindow(query);
    const where = {
      tenantId: actor.tenantId,
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professional.findMany({
        where,
        include: { user: { select: operationalUserSelect } },
        orderBy: { createdAt: 'desc' },
        skip: window.skip,
        take: window.pageSize,
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      data: rows.map((row) => toProfessional(row)),
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async listBookable(actor: AuthUser, query: { page?: number; pageSize?: number }): Promise<Paginated<BookableProfessional>> {
    const window = pageWindow(query);
    const where = { tenantId: actor.tenantId, isActive: true };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.professional.findMany({
        where,
        orderBy: { displayName: 'asc' },
        skip: window.skip,
        take: window.pageSize,
        select: { id: true, displayName: true },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return {
      data: rows,
      meta: pageMeta(window.page, window.pageSize, total),
    };
  }

  async findMine(actor: AuthUser): Promise<ProfessionalProfile> {
    const professional = await this.prisma.professional.findUnique({
      where: { userId: actor.id },
      include: { user: { select: operationalUserSelect } },
    });
    if (!professional || professional.user.role !== UserRole.PROFESSIONAL) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return toProfessional(professional);
  }

  async find(actor: AuthUser, professionalId: string): Promise<ProfessionalProfile> {
    return toProfessional(await this.requireSameTenant(actor, professionalId));
  }

  async create(actor: AuthUser, input: CreateProfessionalDto): Promise<ProfessionalProfile> {
    const passwordHash = await this.passwords.hash(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            tenantId: actor.tenantId,
            name: input.name,
            email: input.email,
            passwordHash,
            role: UserRole.PROFESSIONAL,
            isActive: true,
          },
        });
        if (user.role !== UserRole.PROFESSIONAL || user.tenantId !== actor.tenantId) {
          throw new BadRequestException('O usuário não possui o papel exigido.');
        }
        const professional = await tx.professional.create({
          data: {
            tenantId: actor.tenantId,
            userId: user.id,
            displayName: input.displayName,
            isActive: true,
          },
          include: { user: { select: operationalUserSelect } },
        });
        return toProfessional(professional);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Não foi possível criar o profissional.');
      }
      throw error;
    }
  }

  async update(
    actor: AuthUser,
    professionalId: string,
    input: UpdateProfessionalDto,
  ): Promise<ProfessionalProfile> {
    await this.requireSameTenant(actor, professionalId);
    const professional = await this.prisma.professional.update({
      where: { id: professionalId },
      data: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { user: { select: operationalUserSelect } },
    });
    return toProfessional(professional);
  }

  async deactivate(actor: AuthUser, professionalId: string): Promise<ProfessionalProfile> {
    await this.requireSameTenant(actor, professionalId);
    const professional = await this.prisma.professional.update({
      where: { id: professionalId },
      data: { isActive: false },
      include: { user: { select: operationalUserSelect } },
    });
    return toProfessional(professional);
  }

  private async requireSameTenant(
    actor: AuthUser,
    professionalId: string,
  ): Promise<ProfessionalRow> {
    const professional = await this.prisma.professional.findUnique({
      where: { id: professionalId },
      include: { user: { select: operationalUserSelect } },
    });
    if (!professional) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, professional.tenantId);
    return professional;
  }
}
