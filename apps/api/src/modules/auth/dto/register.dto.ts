import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { TokenDeliveryDto } from './token-delivery.dto';

export class RegisterDto extends TokenDeliveryDto {
  @ApiProperty({ type: String, example: 'Ana Costa', minLength: 2, maxLength: 160 })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ApiProperty({ type: String, example: 'ana@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    type: String,
    example: 'senha-segura',
    minLength: 8,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
