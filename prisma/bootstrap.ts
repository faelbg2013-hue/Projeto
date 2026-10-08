import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { config as loadDotenv } from 'dotenv';
import { PasswordService } from '../apps/api/src/common/auth/password.service';
import {
  BootstrapConflict,
  bootstrapFirstAdmin,
} from '../apps/api/src/config/production-bootstrap';

loadDotenv({ path: resolve(__dirname, '../.env') });

function ask(question: string, secret: boolean): Promise<string> {
  return new Promise((resolveAnswer, reject) => {
    if (!process.stdin.isTTY) {
      reject(
        new Error(
          'O bootstrap precisa de um terminal interativo. Não informe a senha por argumento, variável ou pipe.',
        ),
      );
      return;
    }

    const output = secret
      ? new Writable({
          write(chunk, _encoding, callback) {
            const text = typeof chunk === 'string' ? chunk : chunk.toString();
            if (text.includes('\n') || text.includes('\r')) {
              process.stdout.write('\n');
            }
            callback();
          },
        })
      : process.stdout;

    if (secret) {
      process.stdout.write(question);
    }

    const prompts = createInterface({
      input: process.stdin,
      output,
      terminal: true,
    });
    prompts.question(secret ? '' : question, (answer) => {
      prompts.close();
      resolveAnswer(answer);
    });
  });
}

async function main(): Promise<void> {
  if (process.argv.slice(2).some((arg) => arg.length > 0)) {
    throw new Error('O bootstrap não aceita argumentos. Informe os dados no terminal.');
  }

  const tenantName = await ask('Nome do tenant: ', false);
  const tenantSlug = await ask('Slug do tenant: ', false);
  const adminName = await ask('Nome do administrador: ', false);
  const adminEmail = await ask('E-mail do administrador: ', false);
  const password = await ask('Senha inicial do administrador: ', true);
  const confirmation = await ask('Confirme a senha: ', true);
  if (password !== confirmation) {
    throw new Error('A confirmação da senha não confere.');
  }

  const prisma = new PrismaClient();
  try {
    const result = await bootstrapFirstAdmin(prisma, new PasswordService(), {
      tenantName,
      tenantSlug,
      adminName,
      adminEmail,
      password,
    });
    console.log(`Tenant provisionado: ${result.tenantId}`);
    console.log(`Administrador provisionado: ${result.adminId}`);
  } catch (error) {
    if (error instanceof BootstrapConflict) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Falha no bootstrap';
  console.error(message);
  process.exitCode = 1;
});
