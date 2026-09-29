import { existsSync } from 'node:fs';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

function loadNearestEnv(start: string): void {
  let current = start;

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }

    const parent = resolve(current, '..');
    if (parent === current) {
      return;
    }
    current = parent;
  }
}

export function loadEnvFiles(): void {
  loadNearestEnv(process.cwd());
  loadNearestEnv(__dirname);
}
