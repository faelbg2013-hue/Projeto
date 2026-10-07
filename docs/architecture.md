# Arquitetura

O Ravion Barber é uma plataforma de gestão para barbearia. A fundação API-first já está no ar, com autenticação, usuários, papéis e isolamento por tenant. O aplicativo mobile ainda não existe.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

## Clientes e API

```text
PWA Web
React + Vite + TypeScript
        ↓
     REST API          Flutter + Dart
        ↓               (futuro, mesmo contrato)
 Node.js + NestJS
        ↓
   Prisma ORM
        ↓
      MySQL
```

A tecnologia do cliente não define regra de negócio. `POST /api/v1/appointments` responde da mesma forma para o navegador, para o PWA e para o Flutter.

Não haverá backend separado para o aplicativo Flutter.

## O que cada pasta faz

```text
apps/web          PWA React
apps/api          API NestJS
packages/ui       Tokens visuais do PWA
packages/types    Contratos TypeScript usados só por web e API
packages/validation  Schemas runtime do monorepo TypeScript
packages/config   tsconfig compartilhado
docs              Arquitetura, autenticação, domínio e operação de produção
prisma            Schema, migrations e seed de desenvolvimento
```

Quando o mobile começar, a estrutura prevista é `apps/mobile` com um projeto Flutter independente. Esse diretório não faz parte desta fase.

O Flutter terá models, DTOs, services, repositories e validação de interface próprios. Ele não importa `packages/types`, `packages/validation` nem `packages/ui`. A ponte entre Web, Flutter e API é o contrato HTTP publicado em OpenAPI.

## API

Todas as rotas de negócio e de infraestrutura usam o prefixo versionado `/api/v1`.

Módulos atuais:

- `config`: ambiente, OpenAPI e carga do `.env`
- `health`: `GET /api/v1/health`, público
- `auth`: cadastro, login, refresh, logout e usuário autenticado
- `users`: consulta administrativa limitada ao tenant da sessão, para garantir o isolamento
- `clients`: perfil operacional do cliente
- `professionals`: perfil operacional do profissional
- `schedule`: agenda semanal, bloqueios, exceções e disponibilidade
- `services`: catálogo com preço, duração e pontuação configurável
- `appointments`: criação, consulta, cancelamento, conclusão, não comparecimento e o dia do profissional autenticado
- `dashboard`: visão operacional de um dia civil para o administrador
- `points`: ledger, saldo, extrato e ajuste administrativo
- infraestrutura Prisma, fora de `modules`, porque não é um módulo de negócio

Não há catálogo de recompensas, descontos, cupons, produtos, financeiro ou comissão. O painel em `GET /api/v1/admin/dashboard` resume um dia civil; o valor dos serviços é a soma de `priceSnapshot` e não é pagamento. O profissional lê o próprio dia em `GET /api/v1/professionals/me/dashboard`, sem comissão e sem movimentar pontos. O modelo de domínio está em [domain.md](domain.md), a agenda em [scheduling.md](scheduling.md), o agendamento em [appointments.md](appointments.md), a operação do profissional em [professional-operations.md](professional-operations.md), os pontos em [loyalty.md](loyalty.md) e o resgate em [points-redemption.md](points-redemption.md).

Resposta de saúde:

```json
{
  "status": "ok",
  "service": "ravion-barber-api"
}
```

A API valida `DATABASE_URL` no startup e executa `SELECT 1`. Se o MySQL não responder, o processo não fica de pé. A URL com senha não entra nos logs.

### OpenAPI

A UI fica em `/api/docs`. Os documentos de máquina ficam em `/api/docs-json` e `/api/docs-yaml`, para no futuro gerar ou manter clientes TypeScript e Dart/Flutter.

O documento já publica:

- endpoints, com `operationId` estável
- parâmetros de paginação `page` e `pageSize`
- o formato de erro `ApiErrorResponseDto`
- o envelope `PaginationMetaDto`
- o esquema de autenticação `bearer` (JWT) nas rotas protegidas
- o header `X-Tenant-Slug` no login
- respostas reutilizáveis de erro: 400, 401, 403, 404, 429 e 500

Filtros de listagem serão query params específicos de cada recurso, declarados no DTO daquele endpoint. Não há um filtro genérico.

Em produção a documentação nasce desligada. `SWAGGER_ENABLED=true` liga explicitamente; `false` desliga mesmo em desenvolvimento.

### Erros

Toda falha HTTP segue:

```json
{
  "statusCode": 400,
  "message": "Mensagem do erro",
  "error": "Bad Request"
}
```

Falhas inesperadas viram 500 com mensagem genérica. O stack trace fica no log do servidor e nunca vai para o cliente. Textos de log passam por redação de senha, token, segredo e URL com credencial.

### Segurança já preparada

- CORS por `CORS_ORIGINS`
- Helmet
- `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`)
- Rate limit configurável, com health e Swagger fora do limite
- Segredos apenas em ambiente, validados no boot com Zod
- JWT de acesso com duração curta e refresh opaco revogável
- senha em Argon2id
- guards reutilizáveis de autenticação, papel e tenant

O detalhe da sessão, do cookie do PWA e do futuro cliente Flutter está em [authentication.md](authentication.md).

### Logs

O boot registra a porta e, quando ligada, a rota do Swagger. Cada requisição fora de `/api/docs` registra método, caminho, status e duração. Query string não é registrada. Corpo de requisição não é registrado.

## PWA

`apps/web` é mobile-first. Tokens de cor e tipografia vivem em `packages/ui/src/tokens.css`. A cor de destaque é `--ravion-color-accent`. Componentes usam utilitários Tailwind (`bg-background`, `text-accent`, `font-display`) e não espalham hexadecimais.

O manifesto chama o aplicativo de Ravion Barber, com `display: standalone`, orientação livre e ícones para celular, tablet e desktop. O service worker faz precache do shell e não implementa fila offline, sincronização ou cache da API.

A página inicial apresenta o nome e a frase "Sistema de gestão para barbearia.". Há também `/login`, `/register`, `/conta`, `/agendar`, `/agendamentos`, `/pontos`, `/profissional`, `/profissional/agenda`, `/profissional/agenda/semana`, `/profissional/agendamentos` e a administração em `/admin/dashboard`, `/admin/services`, `/admin/professionals`, `/admin/professionals/:id`, `/admin/professionals/:id/schedule`, `/admin/clients`, `/admin/clients/:id`, `/admin/clients/:id/points` e `/admin/appointments`. `/profissional/agenda` é o dia operacional. `/profissional/agenda/semana` é o editor semanal. A camada `src/services` é o único lugar em que o PWA chama a API. O cliente de autenticação não guarda token no `localStorage`.

## Banco

`docker-compose.yml` sobe MySQL 8.4 para desenvolvimento. Usuário, senha, database e porta vêm do ambiente. O schema tem `tenants`, `users`, `user_sessions`, `clients`, `professionals`, `services`, `professional_schedules`, `professional_time_blocks`, `professional_schedule_exceptions`, `appointments` e `points_transactions`. O e-mail é único por tenant, não no sistema inteiro. O slug do tenant é único. Cliente e profissional são únicos por usuário e também por `(tenantId, userId)`. Agendamento referencia tenant, cliente, profissional e serviço com `ON DELETE RESTRICT`. As migrations ficam em `prisma/migrations`; o fluxo é `prisma migrate dev`, não `db push`.

## Tenant

O tenant separa contextos lógicos de aplicação dentro de um único Ravion Barber. Não é uma unidade física e não é um papel. Toda entidade de dados desse contexto carrega `tenantId`. A autorização lê o tenant da identidade autenticada e recusa o cruzamento entre contextos no backend.

## Testes

- Vitest cobre contratos, validação de ambiente, health, filtro de erro, redação de log, OpenAPI, senha, guards, isolamento entre tenants, clientes, profissionais, serviços, agenda, agendamentos, pontos e as telas de autenticação.
- Playwright percorre a home, o login, o cadastro, a conta, a área do profissional, a agenda, o agendamento, os pontos e a administração em 360, 390, 768, 1024 e 1440 pixels.

## Fora de escopo

Catálogo de recompensas, produtos, financeiro, comissão e o aplicativo Flutter. O painel do dia está em [dashboard.md](dashboard.md). A disponibilidade continua sendo uma prévia. A reserva definitiva está na criação do agendamento. O saldo de pontos sai do ledger.
