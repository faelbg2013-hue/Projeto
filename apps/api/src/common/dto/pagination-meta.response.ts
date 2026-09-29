import { ApiProperty } from '@nestjs/swagger';
import type { PaginationMeta } from '@ravion/types';

export class PaginationMetaDto implements PaginationMeta {
  @ApiProperty({ type: Number, example: 1, minimum: 1 })
  page!: number;

  @ApiProperty({ type: Number, example: 20, minimum: 1, maximum: 100 })
  pageSize!: number;

  @ApiProperty({ type: Number, example: 0, minimum: 0 })
  total!: number;

  @ApiProperty({ type: Number, example: 0, minimum: 0 })
  pageCount!: number;
}
