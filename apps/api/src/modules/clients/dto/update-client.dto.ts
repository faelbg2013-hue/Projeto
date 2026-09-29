import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateClientDto {
  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Desativa o perfil operacional sem apagar o cliente nem o usuário.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
