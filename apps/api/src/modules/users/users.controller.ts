import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe } from '../../common/validation/body.pipe';
import { AuthUserDto } from '../auth/dto/auth-session.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('bearer')
@Roles(UserRole.ADMIN)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    operationId: 'listUsers',
    summary: 'Lista os usuários do tenant autenticado',
    description:
      'Somente ADMIN. A lista contém apenas usuários do tenant da sessão. Não é um módulo de clientes ou profissionais.',
  })
  @ApiOkResponse({ type: AuthUserDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  list(@CurrentUser() actor: AuthUser): Promise<AuthUser[]> {
    return this.usersService.list(actor);
  }

  @Get(':id')
  @ApiOperation({
    operationId: 'getUser',
    summary: 'Consulta um usuário do mesmo tenant',
    description: 'Um identificador de outro tenant responde como recurso não encontrado.',
  })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  find(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<AuthUser> {
    return this.usersService.findForActor(actor, id);
  }

  @Patch(':id')
  @ApiOperation({
    operationId: 'updateUser',
    summary: 'Atualiza nome ou status de um usuário do mesmo tenant',
    description: 'Papel, e-mail, senha e tenantId não são aceitos neste corpo.',
  })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(bodyPipe(UpdateUserDto)) body: UpdateUserDto,
  ): Promise<AuthUser> {
    return this.usersService.update(actor, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({
    operationId: 'deleteUser',
    summary: 'Remove um usuário do mesmo tenant',
  })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorResponseDto })
  remove(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(actor, id);
  }
}
