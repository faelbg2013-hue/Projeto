import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfessionalDto {
  @ApiPropertyOptional({ type: String, example: 'Carlos', minLength: 2, maxLength: 120 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({
    type: Boolean,
    example: false,
    description: 'Desativa a participação operacional sem apagar o profissional nem o usuário.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
