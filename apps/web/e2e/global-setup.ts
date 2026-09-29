import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const apiOrigin = 'http://127.0.0.1:43111';

function envValue(name: string): string {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  const text = readFileSync(fileURLToPath(new URL('../../../.env', import.meta.url)), 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (trimmed.slice(0, separator) === name) {
      return trimmed.slice(separator + 1).trim();
    }
  }
  throw new Error(`Variável ausente: ${name}`);
}

export default async function globalSetup(): Promise<void> {
  const login = await fetch(`${apiOrigin}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tenant-slug': envValue('TENANT_SLUG'),
    },
    body: JSON.stringify({
      email: envValue('ADMIN_EMAIL'),
      password: envValue('ADMIN_PASSWORD'),
    }),
  });
  if (!login.ok) {
    throw new Error(`Preparação dos testes falhou no login: ${login.status}`);
  }
  const { accessToken } = (await login.json()) as { accessToken: string };
  const ids: string[] = [];
  for (let page = 1; page <= 40; page += 1) {
    const response = await fetch(
      `${apiOrigin}/api/v1/professionals?isActive=true&page=${page}&pageSize=100`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      throw new Error(`Preparação dos testes falhou ao listar profissionais: ${response.status}`);
    }
    const body = (await response.json()) as {
      data: Array<{ id: string; user: { email: string } }>;
      meta: { pageCount: number };
    };
    for (const professional of body.data) {
      if (professional.user.email.endsWith('@example.com')) {
        ids.push(professional.id);
      }
    }
    if (body.data.length === 0 || page >= body.meta.pageCount) {
      break;
    }
  }
  for (const id of ids) {
    const removed = await fetch(`${apiOrigin}/api/v1/professionals/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!removed.ok) {
      throw new Error(`Preparação dos testes falhou ao desativar profissional: ${removed.status}`);
    }
  }
}
