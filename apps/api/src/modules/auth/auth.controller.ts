import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Public } from '../../common/auth/public.decorator';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  readRefreshToken,
  TENANT_SLUG_HEADER,
  type RequestWithUser,
} from '../../common/auth/request-auth';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe } from '../../common/validation/body.pipe';
import { AuthService, type AuthSession } from './auth.service';
import { AuthSessionDto, AuthUserDto } from './dto/auth-session.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/session-token.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly secureCookies: boolean;
  private readonly refreshTtlMs: number;

  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    this.secureCookies = config.getOrThrow<string>('NODE_ENV') === 'production';
    const refresh = config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN');
    this.refreshTtlMs = durationToMs(refresh);
  }

  @Post('register')
  @Public()
  @ApiOperation({
    operationId: 'registerClient',
    summary: 'Cria um cliente no tenant público configurado no servidor',
    description:
      'O papel é sempre CLIENT. tenantId e role enviados pelo cliente são rejeitados. O tenant vem de DEFAULT_PUBLIC_TENANT_ID.',
  })
  @ApiCreatedResponse({ type: AuthSessionDto })
  @ApiConflictResponse({ type: ApiErrorResponseDto })
  register(
    @Body(bodyPipe(RegisterDto)) body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    return this.authService.register(body).then((session) => {
      this.attachCookies(response, session);
      return session;
    });
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    operationId: 'login',
    summary: 'Autentica um usuário dentro de um tenant',
    description:
      'O contexto do tenant é o header X-Tenant-Slug. O e-mail é procurado apenas nesse tenant. Credenciais inválidas, usuário inativo e tenant inativo respondem da mesma forma.',
  })
  @ApiHeader({
    name: 'X-Tenant-Slug',
    required: true,
    description: 'Slug do contexto lógico da aplicação, por exemplo web ou mobile.',
    example: 'web',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  login(
    @Headers(TENANT_SLUG_HEADER) tenantSlug: string | undefined,
    @Body(bodyPipe(LoginDto)) body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const slug = tenantSlug?.trim();
    if (!slug) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login({ ...body, tenantSlug: slug }).then((session) => {
      this.attachCookies(response, session);
      return session;
    });
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    operationId: 'refreshSession',
    summary: 'Renova a sessão e revoga o refresh token anterior',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  refresh(
    @Body(bodyPipe(RefreshTokenDto)) body: RefreshTokenDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSession> {
    const refreshToken = readRefreshToken(request, body.refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.authService.refresh(refreshToken).then((session) => {
      this.attachCookies(response, session);
      return session;
    });
  }

  @Post('logout')
  @Public()
  @HttpCode(204)
  @ApiOperation({
    operationId: 'logout',
    summary: 'Revoga o refresh token da sessão atual',
  })
  logout(
    @Body(bodyPipe(RefreshTokenDto)) body: RefreshTokenDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.clearCookies(response);
    return this.authService.logout(readRefreshToken(request, body.refreshToken));
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    operationId: 'getAuthenticatedUser',
    summary: 'Retorna o usuário autenticado no tenant da sessão',
  })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  me(@CurrentUser() actor: AuthUser): Promise<AuthUser> {
    return this.authService.me(actor.id, actor.tenantId);
  }

  private attachCookies(response: Response, session: AuthSession): void {
    response.cookie(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/api',
      maxAge: session.expiresIn * 1000,
    });
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: this.refreshTtlMs,
    });
  }

  private clearCookies(response: Response): void {
    const cookieOptions = {
      httpOnly: true,
      secure: this.secureCookies,
      sameSite: 'lax' as const,
    };
    response.clearCookie(ACCESS_COOKIE, { ...cookieOptions, path: '/api' });
    response.clearCookie(REFRESH_COOKIE, { ...cookieOptions, path: '/api/v1/auth' });
  }
}

function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  const amount = Number(match?.[1] ?? 0);
  const unit = match?.[2];
  const seconds =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3_600 : unit === 'd' ? 86_400 : 0;
  return amount * seconds * 1000;
}
