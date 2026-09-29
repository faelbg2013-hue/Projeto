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
    description:
      'JWT de acesso. O PWA também o recebe em cookie HttpOnly e não deve persistir este campo.',
  })
  accessToken!: string;

  @ApiProperty({
    type: String,
    description:
      'Refresh token opaco. O PWA também o recebe em cookie HttpOnly e não deve persistir este campo.',
  })
  refreshToken!: string;

  @ApiProperty({
    type: Number,
    example: 900,
    description: 'Validade do access token, em segundos.',
  })
  expiresIn!: number;
}
