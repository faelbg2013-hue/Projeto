import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUserRole, type AuthUser } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { readAccessToken, type RequestWithUser } from './request-auth';

interface AccessTokenPayload {
  sub?: string;
  tenantId?: string;
  role?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = readAccessToken(request);
    if (!token) {
      throw new UnauthorizedException('Não autenticado');
    }

    const payload = await this.verify(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || !user.isActive || !user.tenant.isActive || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Não autenticado');
    }

    const authenticated: AuthUser = {
      id: user.id,
      tenantId: user.tenantId,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };
    request.user = authenticated;
    return true;
  }

  private async verify(token: string): Promise<{ sub: string; tenantId: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      if (!payload.sub || !payload.tenantId || !isUserRole(payload.role)) {
        throw new UnauthorizedException('Não autenticado');
      }
      return { sub: payload.sub, tenantId: payload.tenantId };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Não autenticado');
    }
  }
}
