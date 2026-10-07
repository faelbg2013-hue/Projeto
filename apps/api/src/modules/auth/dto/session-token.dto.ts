import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { TokenDeliveryDto } from './token-delivery.dto';

export class RefreshTokenDto extends TokenDeliveryDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'Refresh token opaco. Obrigatório para o cliente Flutter. O PWA envia o cookie HttpOnly ravion_refresh.',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;
}
