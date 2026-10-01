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
      'Somente ADMIN. O tenant sai da sessão. A resposta contém apenas as chaves do contrato atual. F11.1 ainda não publica chaves de negócio.',
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
      'Somente ADMIN. tenantId no corpo é rejeitado. Chaves fora do contrato são rejeitadas. Campos omitidos não são apagados.',
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
