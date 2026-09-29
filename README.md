# Ravion Barber

Plataforma de gestão para barbearia. Esta fase entrega somente a fundação técnica: PWA web, API REST e banco MySQL. Nenhum módulo de negócio está implementado.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

## Arquitetura

```text
PWA Web (React + Vite + TypeScript)
        ↓
     REST API  ←── futuro aplicativo Flutter + Dart
        ↓
 Node.js + NestJS
        ↓
   Prisma ORM
        ↓
      MySQL
```

A API é a única dona das regras de negócio. O PWA e o futuro aplicativo Flutter conversam com ela apenas por HTTP/OpenAPI. Não há compartilhamento de código TypeScript com o Flutter.

Detalhes em [docs/architecture.md](docs/architecture.md).

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, PWA
- Backend: Node.js, TypeScript, NestJS, REST, Swagger/OpenAPI
- Banco: MySQL, Prisma ORM
- Monorepo: pnpm
- Testes: Vitest e Playwright

## Requisitos

- Node.js 22 ou superior
- pnpm 10
- Docker, para o MySQL de desenvolvimento

## Instalação

Na raiz do repositório:

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
```

O arquivo `.env` fica fora do Git. Os valores de `.env.example` são placeholders de desenvolvimento local. Troque senhas e segredos JWT antes de qualquer ambiente compartilhado.

## Configuração do .env

| Variável             | Função                                                                      |
| -------------------- | --------------------------------------------------------------------------- |
| `NODE_ENV`           | `development`, `test` ou `production`                                       |
| `PORT`               | Porta da API. Padrão local: `43111`                                         |
| `DATABASE_URL`       | Conexão Prisma/MySQL                                                        |
| `JWT_SECRET`         | Segredo do access token. Mínimo de 32 caracteres. Ainda não há autenticação |
| `JWT_REFRESH_SECRET` | Segredo do refresh token. Mínimo de 32 caracteres                           |
| `CORS_ORIGINS`       | Origens permitidas, separadas por vírgula                                   |
| `SWAGGER_ENABLED`    | `true` ou `false`. Sem valor, a UI fica ligada fora de produção             |
| `THROTTLE_TTL_MS`    | Janela do rate limit                                                        |
| `THROTTLE_LIMIT`     | Requisições por janela                                                      |
| `LOG_LEVEL`          | `error`, `warn`, `log`, `debug` ou `verbose`                                |
| `VITE_API_URL`       | Base URL da API usada pelo PWA                                              |
| `MYSQL_*`            | Usuário, senha, database e porta do container                               |

A API recusa subir quando a validação do ambiente falha.

## Inicialização do MySQL

```bash
pnpm db:up
```

O Compose sobe um MySQL 8.4 e cria o database definido em `MYSQL_DATABASE` (padrão `ravion_barber`). Para encerrar:

```bash
pnpm db:down
```

O schema Prisma desta fase não declara tabelas de negócio. A conexão é validada na inicialização da API com `SELECT 1`.

## Execução da API

```bash
pnpm dev:api
```

- Health: `GET http://127.0.0.1:43111/api/v1/health`
- OpenAPI JSON: `http://127.0.0.1:43111/api/docs-json`
- OpenAPI YAML: `http://127.0.0.1:43111/api/docs-yaml`
- Swagger UI: `http://127.0.0.1:43111/api/docs`

Em `NODE_ENV=production`, a documentação fica desligada, a menos que `SWAGGER_ENABLED=true`.

## Execução do frontend

```bash
pnpm dev:web
```

Abra `http://127.0.0.1:43110`. A página inicial apresenta o Ravion Barber. O app é um PWA instalável, com manifesto e service worker de cache do shell. Não há modo offline de dados.

Para subir API e PWA juntos:

```bash
pnpm dev
```

## Execução dos testes

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

`pnpm test` executa Vitest. `pnpm test:e2e` executa Playwright nas larguras 360, 390, 768, 1024 e 1440. Na primeira vez, instale o navegador:

```bash
pnpm --filter @ravion/web exec playwright install chromium
```

## O que esta fase não inclui

Login, cadastro, usuários, clientes, profissionais, serviços, agendamentos, calendário, pontos, produtos, financeiro, relatórios e o aplicativo Flutter. O diretório `apps/mobile` será criado apenas quando o desenvolvimento mobile começar.
