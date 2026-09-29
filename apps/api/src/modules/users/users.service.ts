import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '@ravion/types';
import { denyCrossTenant } from '../../common/auth/tenant-access';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { toAuthUser } from '../auth/auth.service';
import type { UpdateUserDto } from './dto/update-user.dto';

const NOT_FOUND = 'Recurso não encontrado';

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(actor: AuthUser): Promise<AuthUser[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => toAuthUser(user));
  }

  async findForActor(actor: AuthUser, userId: string): Promise<AuthUser> {
    const user = await this.requireSameTenant(actor, userId);
    return toAuthUser(user);
  }

  async update(actor: AuthUser, userId: string, input: UpdateUserDto): Promise<AuthUser> {
    await this.requireSameTenant(actor, userId);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return toAuthUser(user);
  }

  async remove(actor: AuthUser, userId: string): Promise<void> {
    await this.requireSameTenant(actor, userId);
    await this.prisma.user.delete({ where: { id: userId } });
  }

  private async requireSameTenant(actor: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(NOT_FOUND);
    }
    denyCrossTenant(actor.tenantId, user.tenantId);
    return user;
  }
}
