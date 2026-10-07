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
  ApiTooManyRequestsResponse,
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
import { AuthThrottle } from '../../common/security/auth-throttle';
import { bodyPipe } from '../../common/validation/body.pipe';
import { AuthService, type AuthSession, type DeliveredAuthSession } from './auth.service';
import type { TokenDelivery } from './dto/token-delivery.dto';
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
  @AuthThrottle('register')
  @ApiTooManyRequestsResponse({
    type: ApiErrorResponseDto,
    description: 'Limite de cadastro excedido. A resposta inclui Retry-After, em segundos.',
  })
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
  ): Promise<DeliveredAuthSession> {
    return this.authService.register(body).then((session) => {
      return this.finish(response, session, body.tokenDelivery);
    });
  }

  @Post('login')
  @Public()
  @AuthThrottle('login')
  @HttpCode(200)
  @ApiTooManyRequestsResponse({
    type: ApiErrorResponseDto,
    description: 'Limite de login excedido. A resposta inclui Retry-After, em segundos.',
  })
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
  ): Promise<DeliveredAuthSession> {
    const slug = tenantSlug?.trim();
    if (!slug) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    return this.authService.login({ ...body, tenantSlug: slug }).then((session) => {
      return this.finish(response, session, body.tokenDelivery);
    });
  }

  @Post('refresh')
  @Public()
  @AuthThrottle('refresh')
  @HttpCode(200)
  @ApiTooManyRequestsResponse({
    type: ApiErrorResponseDto,
    description: 'Limite de renovação excedido. A resposta inclui Retry-After, em segundos.',
  })
  @ApiOperation({
    operationId: 'refreshSession',
    summary: 'Renova a sessão e revoga o refresh token anterior',
    description:
      'A rotação é atômica: o refresh atual só pode ser consumido uma vez. Um token já revogado ou expirado não cria outra sessão. Quando o limite é excedido, a resposta é 429 e traz Retry-After em segundos.',
  })
  @ApiOkResponse({ type: AuthSessionDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  refresh(
    @Body(bodyPipe(RefreshTokenDto)) body: RefreshTokenDto,
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DeliveredAuthSession> {
    const refreshToken = readRefreshToken(request, body.refreshToken);
    if (!refreshToken) {
      throw new UnauthorizedException('Sessão inválida');
    }
    return this.authService.refresh(refreshToken).then((session) => {
      return this.finish(response, session, body.tokenDelivery);
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

  private finish(
    response: Response,
    session: AuthSession,
    delivery: TokenDelivery | undefined,
  ): DeliveredAuthSession {
    this.attachCookies(response, session);
    if (delivery === 'cookie') {
      return { user: session.user, expiresIn: session.expiresIn };
    }
    return session;
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
