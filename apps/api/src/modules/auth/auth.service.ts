import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import type { AuthUser } from '@ravion/types';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PasswordService } from '../../common/auth/password.service';
import {
  createRefreshToken,
  hashRefreshToken,
  parseDurationToSeconds,
} from '../../common/auth/token';

const INVALID_CREDENTIALS = 'Credenciais inválidas';
const INVALID_SESSION = 'Sessão inválida';

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly publicTenantId: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;
  private readonly placeholderHash: Promise<string>;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.publicTenantId = config.getOrThrow<string>('DEFAULT_PUBLIC_TENANT_ID');
    this.accessTtlSeconds = parseDurationToSeconds(
      config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
    );
    this.refreshTtlSeconds = parseDurationToSeconds(
      config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
    this.placeholderHash = this.passwords.hash('not-a-real-password');
  }

  async register(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: this.publicTenantId } });
    if (!tenant?.isActive) {
      throw new ForbiddenException('Cadastro indisponível no momento.');
    }

    const passwordHash = await this.passwords.hash(input.password);
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            tenantId: tenant.id,
            name: input.name,
            email: input.email,
            passwordHash,
            role: 'CLIENT',
            isActive: true,
          },
        });
        if (created.role !== 'CLIENT') {
          throw new BadRequestException('O usuário não possui o papel exigido.');
        }
        await tx.client.create({
          data: {
            tenantId: created.tenantId,
            userId: created.id,
            isActive: true,
          },
        });
        return created;
      });
      return this.openSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Não foi possível concluir o cadastro.');
      }
      throw error;
    }
  }

  async login(input: {
    email: string;
    password: string;
    tenantSlug: string;
  }): Promise<AuthSession> {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: input.tenantSlug } });
    if (!tenant?.isActive) {
      await this.passwords.verify(await this.placeholderHash, input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
    });
    if (!user?.isActive) {
      await this.passwords.verify(await this.placeholderHash, input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const matches = await this.passwords.verify(user.passwordHash, input.password);
    if (!matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.openSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthSession> {
    const session = await this.findUsableSession(rawRefreshToken);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    return this.openSession(session.user);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hashRefreshToken(rawRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string, tenantId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true },
    });
    if (!user || user.tenantId !== tenantId || !user.isActive || !user.tenant.isActive) {
      throw new UnauthorizedException('Não autenticado');
    }
    return toAuthUser(user);
  }

  private async findUsableSession(rawRefreshToken: string): Promise<{
    id: string;
    user: User;
  }> {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshTokenHash: hashRefreshToken(rawRefreshToken) },
      include: { user: { include: { tenant: true } } },
    });
    if (!session || session.expiresAt.getTime() <= Date.now() || session.revokedAt) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (
      !session.user.isActive ||
      !session.user.tenant.isActive ||
      session.tenantId !== session.user.tenantId
    ) {
      throw new UnauthorizedException(INVALID_SESSION);
    }
    return session;
  }

  private async openSession(user: User): Promise<AuthSession> {
    const refreshToken = createRefreshToken();
    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tenantId: user.tenantId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + this.refreshTtlSeconds * 1000),
      },
    });

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, tenantId: user.tenantId, role: user.role },
      { expiresIn: this.accessTtlSeconds },
    );

    return {
      user: toAuthUser(user),
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }
}

export function toAuthUser(
  user: Pick<User, 'id' | 'tenantId' | 'name' | 'email' | 'role' | 'isActive'>,
): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
