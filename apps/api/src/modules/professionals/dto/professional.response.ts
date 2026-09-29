import { ApiProperty } from '@nestjs/swagger';
import type { BookableProfessional, ProfessionalProfile } from '@ravion/types';
import { PaginationMetaDto } from '../../../common/dto/pagination-meta.response';
import { OperationalUserDto } from '../../clients/dto/client.response';

export class ProfessionalResponseDto implements ProfessionalProfile {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  displayName!: string;

  @ApiProperty({ type: Boolean, example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => OperationalUserDto })
  user!: OperationalUserDto;
}

export class PaginatedProfessionalsDto {
  @ApiProperty({ type: () => ProfessionalResponseDto, isArray: true })
  data!: ProfessionalResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export class BookableProfessionalResponseDto implements BookableProfessional {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Carlos' })
  displayName!: string;
}

export class PaginatedBookableProfessionalsDto {
  @ApiProperty({ type: () => BookableProfessionalResponseDto, isArray: true })
  data!: BookableProfessionalResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}
