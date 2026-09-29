# Domínio operacional

Cliente, profissional e serviço são os registros operacionais. A agenda semanal, os bloqueios, as exceções e a disponibilidade estão em [scheduling.md](scheduling.md). O agendamento está em [appointments.md](appointments.md). O ledger de pontos está em [loyalty.md](loyalty.md). Ainda não há pagamento ou financeiro.

O tenant continua sendo o contexto lógico da aplicação, não uma barbearia. O `tenantId` de qualquer um desses registros sai da sessão autenticada. Um valor enviado pelo cliente é rejeitado pelo `ValidationPipe` e não muda o registro.

```text
Tenant
├── Users
│   ├── Client?          role CLIENT
│   └── Professional?    role PROFESSIONAL
├── Services
└── Appointments         client + professional + service, com snapshot do serviço
```

Nome, e-mail e senha ficam em `User`. `Client` e `Professional` não copiam esses dados. A resposta nunca inclui `passwordHash`.

## Client

Campos: `id`, `tenantId`, `userId`, `isActive`, `createdAt`, `updatedAt`.

O cadastro público cria `User` com papel `CLIENT` e o `Client` na mesma transação. Um usuário tem no máximo um perfil de cliente. A constraint é `UNIQUE(userId)` e `UNIQUE(tenantId, userId)`.

Não há exclusão física. O administrador desativa com `isActive = false`. O usuário continua podendo entrar; o perfil operacional é que fica inativo.

| Método | Rota                  | Quem   |
| ------ | --------------------- | ------ |
| GET    | `/api/v1/clients/me`  | CLIENT |
| GET    | `/api/v1/clients`     | ADMIN  |
| GET    | `/api/v1/clients/:id` | ADMIN  |
| PATCH  | `/api/v1/clients/:id` | ADMIN  |

`CLIENT` não usa `GET /api/v1/clients/:id`. A rota `me` é declarada antes de `:id`.

## Professional

Campos: `id`, `tenantId`, `userId`, `displayName`, `isActive`, `createdAt`, `updatedAt`.

Somente `ADMIN` cria profissional. A operação cria o `User` com papel `PROFESSIONAL` e o `Professional` na mesma transação. O cadastro público não faz isso. Um usuário `CLIENT` não é associado a `Professional`.

Desativar coloca `isActive = false` e preserva o registro para o histórico futuro. O usuário não é apagado.

| Método | Rota                             | Quem                                                |
| ------ | -------------------------------- | --------------------------------------------------- |
| GET    | `/api/v1/professionals/me`       | PROFESSIONAL                                        |
| GET    | `/api/v1/professionals/bookable` | CLIENT, PROFESSIONAL e ADMIN. Só ativos, sem e-mail |
| GET    | `/api/v1/professionals`          | ADMIN                                               |
| POST   | `/api/v1/professionals`          | ADMIN                                               |
| GET    | `/api/v1/professionals/:id`      | ADMIN                                               |
| PATCH  | `/api/v1/professionals/:id`      | ADMIN                                               |
| DELETE | `/api/v1/professionals/:id`      | ADMIN                                               |

`DELETE` desativa. Não remove a linha. `PROFESSIONAL` não consulta outro profissional.

## Service

Campos: `id`, `tenantId`, `name`, `description`, `price`, `durationMinutes`, `points`, `isActive`, `createdAt`, `updatedAt`.

- `name` é obrigatório e não é um enum. Não há unicidade de nome.
- `description` pode ser nula.
- `price` é `DECIMAL(10,2)`. A API devolve string com duas casas, por exemplo `"45.00"`. Preço negativo é rejeitado. O banco também recusa preço negativo.
- `durationMinutes` é inteiro maior que zero e no máximo 1440. A disponibilidade usa esse valor para limitar o horário de início.
- `points` é inteiro maior ou igual a zero e no máximo 100000. É a pontuação configurada do serviço, não um saldo.
- Não existe entidade de categoria.

| Método | Rota                   | Quem                                      |
| ------ | ---------------------- | ----------------------------------------- |
| GET    | `/api/v1/services`     | CLIENT, PROFESSIONAL e ADMIN autenticados |
| POST   | `/api/v1/services`     | ADMIN                                     |
| GET    | `/api/v1/services/:id` | autenticado, no próprio tenant            |
| PATCH  | `/api/v1/services/:id` | ADMIN                                     |
| DELETE | `/api/v1/services/:id` | ADMIN, desativação lógica                 |

`CLIENT` e `PROFESSIONAL` recebem somente serviços ativos, mesmo se pedirem `isActive=false`. Um serviço inativo responde 404 para eles. `ADMIN` omite o filtro para ver todos, ou envia `isActive=true` ou `isActive=false`.

## Listagem

O contrato de paginação é o que o OpenAPI já publicava: `page` e `pageSize`, com envelope `{ data, meta }`. `meta` traz `page`, `pageSize`, `total` e `pageCount`. O padrão é página 1 e 20 itens, no máximo 100. A ordenação é `createdAt` descendente. Não há ordenação por campo arbitrário.

## Isolamento

Consulta, alteração e desativação de um registro de outro tenant respondem `404` com a mensagem `Recurso não encontrado`, mesmo quando o UUID é conhecido. Papel insuficiente responde `403` com `Acesso negado`.

## PWA

- `/conta` mostra nome, e-mail, perfil e serviços ativos.
- `/profissional` mostra nome de exibição, perfil, status e serviços ativos.
- `/profissional/agenda` configura a semana, bloqueios, exceções e a consulta de disponibilidade do próprio profissional.
- `/admin/services`, `/admin/professionals` e `/admin/clients` fazem a operação administrativa simples.
- `/admin/professionals/:id/schedule` faz o mesmo para um profissional do tenant.

O Flutter ainda não existe. Ele consumirá estas mesmas rotas.
