# Ravion Barber

Plataforma de gestão para barbearia. A fundação técnica está no ar, com usuários, autenticação, papéis, clientes, profissionais, serviços, agenda, agendamento, pontos e isolamento por tenant. Recompensas continuam fora.

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

Detalhes em [docs/architecture.md](docs/architecture.md), [docs/authentication.md](docs/authentication.md), [docs/domain.md](docs/domain.md), [docs/appointments.md](docs/appointments.md), [docs/loyalty.md](docs/loyalty.md) e [docs/points-redemption.md](docs/points-redemption.md).

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

| Variável                                        | Função                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `NODE_ENV`                                      | `development`, `test` ou `production`                               |
| `PORT`                                          | Porta da API. Padrão local: `43111`                                 |
| `DATABASE_URL`                                  | Conexão Prisma/MySQL                                                |
| `JWT_SECRET`                                    | Segredo do access token. Mínimo de 32 caracteres. Em produção, o placeholder de desenvolvimento é recusado |
| `JWT_REFRESH_SECRET`                            | Obrigatório. O refresh atual é opaco e não usa este segredo. Em produção, o placeholder também é recusado |
| `JWT_ACCESS_EXPIRES_IN`                         | Duração do access token, como `15m`                                 |
| `JWT_REFRESH_EXPIRES_IN`                        | Duração do refresh token, como `7d`                                 |
| `DEFAULT_PUBLIC_TENANT_ID`                      | UUID do tenant usado no cadastro público                            |
| `TENANT_NAME` / `TENANT_SLUG`                   | Nome e slug do tenant criado pelo seed                              |
| `ADMIN_TENANT_ID`                               | UUID do tenant do primeiro administrador                            |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Dados do primeiro administrador. A senha não vai para o código      |
| `SEED_CLIENT_*`                                 | Cliente de desenvolvimento. Senha ignorada se o usuário já existir  |
| `SEED_PROFESSIONAL_*`                           | Profissional de desenvolvimento. Não redefine senha existente       |
| `CORS_ORIGINS`                                  | Origens permitidas, separadas por vírgula                           |
| `SWAGGER_ENABLED`                               | `true` ou `false`. Sem valor, a UI fica ligada fora de produção     |
| `THROTTLE_TTL_MS`                               | Janela do rate limit geral, em milissegundos. Padrão: `60000`       |
| `THROTTLE_LIMIT`                                | Requisições por rota e IP nessa janela. Padrão: `120`               |
| `AUTH_THROTTLE_TTL_MS`                          | Janela dos limites de login, cadastro e refresh, em milissegundos. Padrão: `60000` |
| `AUTH_LOGIN_LIMIT`                              | Logins por IP na janela de auth. Padrão: `10`                       |
| `AUTH_REGISTER_LIMIT`                           | Cadastros por IP na janela de auth. Padrão: `5`                     |
| `AUTH_REFRESH_LIMIT`                            | Renovações por IP na janela de auth. Padrão: `30`                   |
| `TRUST_PROXY`                                   | `false` ou `0` não confia em proxy. Inteiro positivo é o número de proxies confiáveis, como `1`. `true` é recusado |
| `LOG_LEVEL`                                     | `error`, `warn`, `log`, `debug` ou `verbose`                        |
| `VITE_API_URL`                                  | Vazio = mesma origem, a opção recomendada. Em desenvolvimento, a ausência usa o endereço local. O build de produção exige a variável e recusa localhost e HTTP absoluto |
| `VITE_TENANT_SLUG`                              | Slug enviado pelo PWA só no login                                   |
| `MYSQL_*`                                       | Usuário, senha, database e porta do container                       |

A API recusa subir quando a validação do ambiente falha.

## Inicialização do MySQL

```bash
pnpm db:up
```

O Compose sobe um MySQL 8.4 e cria o database definido em `MYSQL_DATABASE` (padrão `ravion_barber`). Para encerrar:

```bash
pnpm db:down
```

Em desenvolvimento, aplique a migration e o seed idempotente:

```bash
pnpm db:migrate
pnpm db:seed
```

`pnpm db:migrate` executa `prisma migrate dev` e fica restrito ao desenvolvimento. Produção e CI usam `pnpm db:migrate:deploy` (`prisma migrate deploy`). Não usar em produção `prisma migrate dev`, `prisma db push` nem `prisma migrate reset`.

O seed cria o tenant, o administrador, um cliente, um profissional e os serviços Corte, Barba e Corte + Barba. Se o profissional de desenvolvimento ainda não tem agendamento, cria um confirmado na próxima segunda às 10:00. Rodar de novo não duplica e não redefine senha. Clientes do tenant de desenvolvimento que ainda não tinham perfil recebem um `Client`. A conexão também é validada na inicialização da API com `SELECT 1`. Com `NODE_ENV=production` o seed termina em erro antes de abrir o banco. As senhas do exemplo não servem para produção. O caminho de produção, backup e restore está em [docs/production-operations.md](docs/production-operations.md).

## Execução da API

```bash
pnpm dev:api
```

- Liveness: `GET http://127.0.0.1:43111/api/v1/health/live` e o alias `GET /api/v1/health`
- Readiness: `GET http://127.0.0.1:43111/api/v1/health/ready`
- OpenAPI JSON: `http://127.0.0.1:43111/api/docs-json`
- OpenAPI YAML: `http://127.0.0.1:43111/api/docs-yaml`
- Swagger UI: `http://127.0.0.1:43111/api/docs`

Em `NODE_ENV=production`, a documentação fica desligada, a menos que `SWAGGER_ENABLED=true`.

## Execução do frontend

```bash
pnpm dev:web
```

Abra `http://127.0.0.1:43110`. A página inicial apresenta o Ravion Barber. Entrar e criar conta ficam em `/login` e `/register`. A conta fica em `/conta`. O cliente agenda em `/agendar`, vê os horários em `/agendamentos` e o extrato em `/pontos`. O profissional autenticado usa `/profissional`, `/profissional/agenda`, `/profissional/agenda/semana` e `/profissional/agendamentos`. A agenda do dia mostra os próprios atendimentos, a conclusão, a falta, o cancelamento e o bloqueio de horário. O horário semanal fica em `/profissional/agenda/semana`. O administrador usa `/admin/dashboard`, `/admin/services`, `/admin/professionals`, `/admin/clients`, `/admin/clients/:id/points` e `/admin/appointments`. O app é um PWA instalável, com manifesto e service worker de cache do shell. Não há modo offline de dados. O navegador usa o proxy `/api`, então o cookie de sessão permanece HttpOnly.

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

## O que ainda não existe

Catálogo de recompensas, descontos, cupons, produtos, financeiro, comissão e o aplicativo Flutter. O painel do dia está em [docs/dashboard.md](docs/dashboard.md). A operação do profissional está em [docs/professional-operations.md](docs/professional-operations.md). A disponibilidade consulta horários e não reserva; a reserva acontece em `POST /api/v1/appointments`. Esse pedido pode usar pontos. Concluir o atendimento credita o `pointsSnapshot` uma vez. O Ravion Barber não processa pagamentos: o preço em reais é o valor cadastrado do serviço, e dinheiro, PIX ou cartão ficam fora da aplicação. O diretório `apps/mobile` será criado apenas quando o desenvolvimento mobile começar. O Flutter usará esta mesma API. A agenda está em [docs/scheduling.md](docs/scheduling.md), o agendamento em [docs/appointments.md](docs/appointments.md), os pontos em [docs/loyalty.md](docs/loyalty.md) e o resgate em [docs/points-redemption.md](docs/points-redemption.md).
