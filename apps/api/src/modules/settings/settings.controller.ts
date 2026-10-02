import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole, type AuthUser, type TenantSettingsResponse } from '@ravion/types';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiErrorResponseDto } from '../../common/dto/api-error.response';
import { bodyPipe } from '../../common/validation/body.pipe';
import { SettingsResponseDto } from './dto/settings.response';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth('bearer')
@Roles(UserRole.ADMIN)
@Controller({ path: 'settings', version: '1' })
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({
    operationId: 'getSettings',
    summary: 'Lê as preferências do tenant autenticado',
    description:
      'Somente ADMIN. O tenant sai da sessão. A resposta contém business_hours somente quando o estabelecimento já salvou o horário. A ausência da chave não grava o padrão.',
  })
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  get(@CurrentUser() actor: AuthUser): Promise<TenantSettingsResponse> {
    return this.settingsService.get(actor);
  }

  @Patch()
  @ApiOperation({
    operationId: 'updateSettings',
    summary: 'Atualiza as preferências permitidas do tenant autenticado',
    description:
      'Somente ADMIN. Aceita business_hours completo e validado. tenantId e chaves fora do contrato são rejeitados. Campos omitidos não são apagados.',
  })
  @ApiBody({ type: UpdateSettingsDto })
  @ApiOkResponse({ type: SettingsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorResponseDto })
  update(
    @CurrentUser() actor: AuthUser,
    @Body(bodyPipe(UpdateSettingsDto)) body: UpdateSettingsDto,
  ): Promise<TenantSettingsResponse> {
    return this.settingsService.update(actor, body);
  }
}
