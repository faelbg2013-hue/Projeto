import { ApiProperty } from '@nestjs/swagger';
import type { AuthUser, UserRole } from '@ravion/types';

export class AuthUserDto implements AuthUser {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, example: 'Ana Costa' })
  name!: string;

  @ApiProperty({ type: String, example: 'ana@example.com' })
  email!: string;

  @ApiProperty({
    type: String,
    enum: ['CLIENT', 'PROFESSIONAL', 'ADMIN'],
    example: 'CLIENT',
  })
  role!: UserRole;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;
}

export class AuthSessionDto {
  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({
    type: String,
    required: false,
    description:
      'JWT de acesso. Presente quando tokenDelivery é bearer, o padrão. Omitido quando o cliente pede cookie. O PWA não deve persistir este campo.',
  })
  accessToken?: string;

  @ApiProperty({
    type: String,
    required: false,
    description:
      'Refresh token opaco. Presente quando tokenDelivery é bearer, o padrão. Omitido quando o cliente pede cookie. O PWA não deve persistir este campo.',
  })
  refreshToken?: string;

  @ApiProperty({
    type: Number,
    example: 900,
    description: 'Validade do access token, em segundos.',
  })
  expiresIn!: number;
}
