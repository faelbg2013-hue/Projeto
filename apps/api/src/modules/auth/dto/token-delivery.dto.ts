import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export const TOKEN_DELIVERIES = ['bearer', 'cookie'] as const;
export type TokenDelivery = (typeof TOKEN_DELIVERIES)[number];

export class TokenDeliveryDto {
  @ApiPropertyOptional({
    enum: TOKEN_DELIVERIES,
    default: 'bearer',
    description:
      'bearer devolve accessToken e refreshToken no JSON, para clientes de API. cookie omite esses campos; a sessão fica só nos cookies HttpOnly. O padrão é bearer.',
  })
  @IsOptional()
  @IsIn(TOKEN_DELIVERIES)
  tokenDelivery?: TokenDelivery;
}
