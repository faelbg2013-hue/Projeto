# Agendamentos

O agendamento confirma um horário para um cliente, um profissional e um serviço. A consulta de disponibilidade continua sendo só uma prévia. A proteção contra duas reservas no mesmo período acontece na gravação.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

## Appointment

Tabela `appointments`.

| Campo | Papel |
| ----- | ----- |
| `id` | UUID |
| `tenantId` | Tenant da sessão |
| `clientId` | Cliente dono do agendamento |
| `professionalId` | Profissional escolhido |
| `serviceId` | Serviço escolhido |
| `startAt` / `endAt` | Instante de início e fim |
| `status` | `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| `notes` | Observação opcional, até 500 caracteres |
| `serviceNameSnapshot` | Nome do serviço no momento da criação |
| `servicePriceSnapshot` | `DECIMAL(10,2)`, preço na criação |
| `serviceDurationMinutesSnapshot` | Duração em minutos na criação |
| `idempotencyKey` | Chave opcional do duplo clique |
| `cancelledAt` / `completedAt` | Preenchidos na transição correspondente |
| `createdAt` / `updatedAt` | Auditoria mínima |

Nome, e-mail e nome de exibição não são copiados para a linha. A resposta lê o cliente e o profissional pelos relacionamentos. O nome, o preço e a duração exibidos vêm do snapshot do serviço.

Foreign keys para `tenants`, `clients`, `professionals` e `services` usam `ON DELETE RESTRICT`. Apagar fisicamente um usuário, cliente, profissional ou serviço que ainda tenha agendamento falha. O histórico não some por cascade. A agenda semanal, os bloqueios e as exceções continuam sendo configuração e ainda acompanham o profissional.

Índices: `(tenantId, professionalId, startAt)`, `(tenantId, clientId, startAt)` e único `(tenantId, clientId, idempotencyKey)`. Várias linhas com chave nula são permitidas. Checks: `startAt < endAt`, duração maior que zero e preço maior ou igual a zero.

Não há `UNIQUE(professionalId, startAt)`. Dois inícios diferentes podem se sobrepor, como 10:00–11:00 e 10:30–11:30.

## Estados

A criação grava `CONFIRMED`. `PENDING` existe no enum e ocupa horário, mas esta fase não abre fluxo pendente.

Transições permitidas, todas a partir de `CONFIRMED`:

- `COMPLETED` preenche `completedAt` e gera um único crédito de pontos com `pointsSnapshot`. O extrato está em [loyalty.md](loyalty.md).
- `CANCELLED` preenche `cancelledAt`. O registro permanece.
- `NO_SHOW` não preenche `cancelledAt` nem `completedAt`.

`COMPLETED`, `CANCELLED` e `NO_SHOW` não voltam para `CONFIRMED`. Cancelar de novo, concluir um cancelado ou cancelar um atendimento concluído responde 409 `A transição de status não é permitida.` Não há prazo de "até X horas antes". Não há endpoint de reagendamento.

`CANCELLED` deixa de ocupar o horário. `CONFIRMED`, `COMPLETED` e `NO_SHOW` continuam ocupando o intervalo histórico.

## Criação

`POST /api/v1/appointments`, somente `CLIENT`, 201.

```json
{
  "professionalId": "uuid",
  "serviceId": "uuid",
  "date": "2026-10-05",
  "time": "10:30",
  "notes": "opcional"
}
```

O backend rejeita com 400 qualquer um destes campos no corpo: `tenantId`, `clientId`, `endAt`, `status`, `price`, `duration`, snapshots. O cliente é o usuário autenticado. Profissional ou serviço inexistente, de outro tenant ou inativo responde 404 `Recurso não encontrado`. Cliente inativo responde 403 `O cliente está inativo.`

`date` é `YYYY-MM-DD` e `time` é `HH:mm`, interpretados em `America/Sao_Paulo`. O navegador não define o fuso. `endAt` é `startAt` mais `serviceDurationMinutesSnapshot`. Data passada responde 400 `Não é possível agendar em uma data passada.` No dia de hoje, `startAt` menor ou igual a agora responde 400 `O horário já passou.`

A criação reutiliza `ScheduleService.computeSlots`, o mesmo cálculo da disponibilidade. A lista `occupied` traz os agendamentos do profissional que cruzam o dia pedido e estão em `PENDING`, `CONFIRMED`, `COMPLETED` ou `NO_SHOW`. A consulta não carrega o histórico inteiro: `startAt < fim do dia` e `endAt > início do dia`.

Dois intervalos conflitam quando um começa antes do fim do outro e termina depois do início do outro. 10:00–10:30 seguido de 10:30–11:00 é permitido.

Se o horário não passa nessa segunda verificação, a resposta é 409 `Este horário não está mais disponível.`

### Idempotência

Header opcional `Idempotency-Key`, de 8 a 80 caracteres em `[A-Za-z0-9_-]`. A mesma chave, o mesmo cliente e o mesmo corpo devolvem o agendamento já criado, sem segunda linha. A mesma chave com outro profissional, serviço, data, horário ou observação responde 409 `A chave de idempotência já foi utilizada.` Chave inválida responde 400 `Chave de idempotência inválida.`

## Concorrência

A disponibilidade lida não reserva. Duas requisições podem ver 10:00 ao mesmo tempo. A exclusão acontece dentro da transação de criação.

`prisma.$transaction` interativa, isolamento `ReadCommitted`, timeout de 10 segundos:

1. `SELECT id FROM professionals WHERE id = ? AND tenantId = ? FOR UPDATE`
2. Relê profissional, serviço e cliente e recusa inativo ou de outro tenant.
3. Calcula `endAt` com a duração relida do serviço.
4. Chama `computeSlots` na mesma transação, já com os agendamentos confirmados visíveis.
5. Procura sobreposição `startAt < endAt` e `endAt > startAt` nos status que ocupam horário.
6. Insere `CONFIRMED` com os snapshots.
7. Commit. Conflito faz rollback.

O que fica bloqueado é uma linha: o profissional escolhido. O lock começa no `SELECT ... FOR UPDATE` e termina no commit ou no rollback, na casa dos milissegundos de uma gravação. Outro agendamento para o mesmo profissional espera essa linha. Agendamentos de profissionais diferentes não se serializam entre si.

`ReadCommitted` é usado de propósito. O segundo escritor, ao obter o lock, precisa ler o agendamento que o primeiro acabou de confirmar. Um snapshot antigo, tomado antes do commit do outro, não serviria. O isolamento não é alterado na sessão global do MySQL e não é `SERIALIZABLE`.

MySQL não tem constraint de exclusão para intervalos. Um único em `startAt` deixaria passar 10:00–11:00 contra 10:30–11:30. A fila no profissional mais a consulta de sobreposição dentro do lock cobre esse caso: a segunda transação só lê depois que a primeira commitou, vê o conflito e responde 409.

`Lock wait timeout`, deadlock (`P2034` ou a mensagem do MySQL) também viram 409 `Este horário não está mais disponível.`, não 500. A linha do serviço não é travada; o preço e a duração gravados são os relidos dentro da transação.

Cancelar, concluir e marcar não comparecimento travam a linha do próprio agendamento com `SELECT ... FOR UPDATE` antes de mudar o status.

O teste de concorrência não é sequencial. Ele dispara dois `POST` com `Promise.all` para o mesmo profissional, serviço, data e horário. O resultado observado é um 201, um 409 com a mensagem de horário indisponível, e uma única linha `CONFIRMED`.

## Consulta e transições

| Método | Rota | Quem |
| ------ | ---- | ---- |
| POST | `/api/v1/appointments` | CLIENT, para si |
| GET | `/api/v1/appointments/me` | CLIENT. `view=upcoming` é `CONFIRMED`; `view=history` é `COMPLETED`, `CANCELLED`, `NO_SHOW` |
| GET | `/api/v1/appointments/:id` | CLIENT o próprio; PROFESSIONAL o próprio; ADMIN qualquer um do tenant |
| GET | `/api/v1/professionals/me/appointments` | PROFESSIONAL. Filtros `date` e `status` |
| GET | `/api/v1/appointments` | ADMIN. Filtros `professionalId`, `clientId`, `serviceId`, `date`, `startDate`, `endDate`, `status` |
| PATCH | `/api/v1/appointments/:id/cancel` | CLIENT o próprio, PROFESSIONAL o próprio, ADMIN do tenant |
| PATCH | `/api/v1/appointments/:id/complete` | PROFESSIONAL do atendimento ou ADMIN |
| PATCH | `/api/v1/appointments/:id/no-show` | PROFESSIONAL do atendimento ou ADMIN |
| GET | `/api/v1/professionals/bookable` | CLIENT, PROFESSIONAL e ADMIN. Só profissionais ativos, `id` e `displayName` |

Listagens usam `page` e `pageSize` e o envelope `{ data, meta }`. A ordem é `startAt` ascendente e depois `id`. Registro de outro tenant, ou de outro cliente ou profissional quando o papel não alcança, responde 404 `Recurso não encontrado`. CLIENT que tenta concluir ou marcar não comparecimento recebe 403 `Acesso negado.`

`date` é um dia civil e tem precedência sobre `startDate` e `endDate`. `startDate` posterior a `endDate` responde 400 `Data inválida.` Filtro com id de outro tenant responde 404.

A resposta traz id, nomes por relacionamento, snapshot de serviço, preço em string com duas casas, duração, data, horário `HH:mm`, `startAt` e `endAt` com offset `-03:00`, status, observação e as datas de auditoria. Não devolve `passwordHash`.

## PWA

- `/agendar` — profissional, serviço, data, horários daquele dia, observação, resumo e confirmação.
- `/agendamentos` — próximos e histórico. O cliente cancela os próprios confirmados.
- `/profissional/agendamentos` — data, horário, cliente, serviço, duração, valor e status. Concluir, não comparecimento e cancelar.
- `/admin/appointments` — os mesmos atos, com filtros de profissional, cliente, serviço, data e status.

O horário só aparece depois da consulta de disponibilidade. O resumo mostra profissional, serviço, data, horário, duração e valor antes do envio. O sucesso mostra os mesmos dados do agendamento gravado. Não há promessa de pontos.

## Fora desta fase

Pontos, fidelidade, financeiro, pagamento, notificação, WhatsApp, comissão e reagendamento não são criados aqui. O snapshot de preço guarda o valor histórico do serviço. Não gera lançamento financeiro.
