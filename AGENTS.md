# Ravion Barber

Plataforma de gestão para barbearia. A fundação técnica e a autenticação com tenant já existem. A próxima fase não começa sem uma instrução nova.

## Arquitetura oficial

O PWA web usa React, Vite e TypeScript. Ele consome a REST API em Node.js, NestJS, Prisma e MySQL.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

Não criar backend separado para o Flutter. Não criar `apps/mobile` até a fase de desenvolvimento mobile. Quando essa fase começar, o diretório será um projeto Flutter independente, organizado por features, com models, DTOs, services, repositories e validação de interface próprios.

## Regras para agentes

- A API é a dona das regras de negócio. Não colocar regra de negócio em componentes React nem em código que só exista para um cliente.
- Não compartilhar pacotes TypeScript com o Flutter. `packages/types` e `packages/validation` servem ao monorepo TypeScript. O contrato com o Flutter é OpenAPI.
- Manter rotas em `/api/v1`.
- Manter erros no formato `statusCode`, `message`, `error`, sem stack trace para o cliente.
- Não registrar senha, token, segredo ou connection string.
- O tenant é contexto lógico de aplicação, não uma barbearia e não um papel. Não aceitar `tenantId` vindo do cliente como autorização.
- Cliente, profissional, serviço, agenda, agendamento, o ledger de pontos, o painel administrativo e a área operacional do profissional já existem e respeitam o tenant da sessão. O cliente pode agendar em modo `NORMAL` ou `POINTS`. O profissional vê o próprio dia em `GET /api/v1/professionals/me/dashboard` e não movimenta pontos. Não implementar catálogo de recompensas, descontos, cupons, produtos, financeiro, pagamento, notificação, WhatsApp ou comissão sem uma fase que peça isso. O saldo sai do ledger, não de um campo no cliente. O preço em reais não é um pagamento.
- Não guardar senha em texto puro nem devolver `passwordHash`. Não persistir o refresh token puro.
- Swagger fica em `/api/docs` e não deve ficar exposto em produção sem `SWAGGER_ENABLED`.
- Preservar os tokens visuais em `packages/ui`. Não espalhar cores soltas pelos componentes.

## Comandos

```bash
pnpm install
pnpm db:up
pnpm dev:api
pnpm dev:web
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```
