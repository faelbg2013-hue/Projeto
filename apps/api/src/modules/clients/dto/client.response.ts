import { ApiProperty } from '@nestjs/swagger';
import type { ClientProfile, UserRole } from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';

export class OperationalUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Ana Costa' })
  name!: string;

  @ApiProperty({ type: String, example: 'ana@example.com' })
  email!: string;

  @ApiProperty({ type: String, enum: ['CLIENT', 'PROFESSIONAL', 'ADMIN'], example: 'CLIENT' })
  role!: UserRole;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;
}

export class ClientResponseDto implements ClientProfile {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => OperationalUserDto })
  user!: OperationalUserDto;
}

export class PaginatedClientsDto {
  @ApiProperty({ type: () => ClientResponseDto, isArray: true })
  data!: ClientResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
