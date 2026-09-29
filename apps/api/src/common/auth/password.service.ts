import * as argon2 from 'argon2';
import { Injectable } from '@nestjs/common';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  hash(plainText: string): Promise<string> {
    return argon2.hash(plainText, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainText);
    } catch {
      return false;
    }
  }
}
