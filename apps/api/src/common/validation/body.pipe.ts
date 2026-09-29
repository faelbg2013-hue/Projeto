import { ValidationPipe, type Type } from '@nestjs/common';

export function bodyPipe(expectedType: Type): ValidationPipe {
  return new ValidationPipe({
    expectedType,
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
}
