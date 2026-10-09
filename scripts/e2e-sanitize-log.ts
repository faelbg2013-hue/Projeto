import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeEvidenceText } from '../apps/api/src/config/e2e-evidence';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const outputDir = resolve(root, 'e2e-logs', 'sanitized');
const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.woff',
  '.woff2',
  '.ttf',
  '.webm',
  '.mp4',
]);

function sanitizeTree(source: string, target: string): void {
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.name === 'sanitized') {
      continue;
    }
    const from = join(source, entry.name);
    const to = join(target, entry.name);
    if (entry.isDirectory()) {
      sanitizeTree(from, to);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    const extension = extname(entry.name).toLowerCase();
    if (extension === '.zip') {
      sanitizeZip(from, to);
      continue;
    }
    const bytes = readFileSync(from);
    if (binaryExtensions.has(extension) || bytes.includes(0)) {
      writeFileSync(to, bytes);
      continue;
    }
    writeFileSync(to, sanitizeEvidenceText(bytes.toString('utf8')));
  }
}

function sanitizeZip(from: string, to: string): void {
  const dir = join(tmpdir(), `ravion-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const input = join(dir, 'in');
  const extracted = join(dir, 'out');
  try {
    mkdirSync(input, { recursive: true });
    execFileSync('unzip', ['-q', from, '-d', input], { stdio: 'ignore' });
    sanitizeTree(input, extracted);
    mkdirSync(dirname(to), { recursive: true });
    execFileSync('zip', ['-qr', to, '.'], { cwd: extracted, stdio: 'ignore' });
  } catch {
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(`${to}.omitted.txt`, 'Arquivo compactado omitido porque não foi possível sanitizá-lo.\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function sanitizeRoot(source: string, target: string, missingNote: string): void {
  if (!existsSync(source)) {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'ausente.txt'), missingNote);
    return;
  }
  sanitizeTree(source, target);
}

sanitizeRoot(resolve(root, 'e2e-logs'), resolve(outputDir, 'logs'), 'Log da execução ausente.\n');
sanitizeRoot(
  resolve(root, 'apps/web/test-results'),
  resolve(outputDir, 'test-results'),
  'Resultados do Playwright ausentes.\n',
);
sanitizeRoot(
  resolve(root, 'apps/web/playwright-report'),
  resolve(outputDir, 'playwright-report'),
  'Relatório do Playwright ausente.\n',
);
console.log('Evidências E2E sanitizadas em e2e-logs/sanitized.');
