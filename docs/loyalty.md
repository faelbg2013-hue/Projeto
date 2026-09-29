# Fidelidade

O saldo de pontos não fica num campo do cliente. A fonte é o ledger `points_transactions`. Cada crédito ou débito é uma linha. O saldo é a soma dos créditos menos a soma dos débitos.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

## Movimentação

`points` é inteiro e sempre positivo. O tipo decide o sinal.

| Tipo | Efeito | Quem cria |
| ---- | ------ | --------- |
| `EARN` | crédito | somente a conclusão do atendimento |
| `REDEEM` | débito | reservado para recompensas; não há endpoint público |
| `ADJUSTMENT_CREDIT` | crédito | ADMIN do tenant |
| `ADJUSTMENT_DEBIT` | débito | ADMIN do tenant |

Créditos: `EARN` e `ADJUSTMENT_CREDIT`. Débitos: `REDEEM` e `ADJUSTMENT_DEBIT`.

Não existe alteração nem exclusão de linha. Um engano se corrige com um novo ajuste e um motivo. `createdByUserId` sai da sessão e pode ficar nulo se esse usuário for removido. `tenantId` também sai da sessão.

`points > 0`. Zero e negativo não entram no ledger.

## Agendamento

`appointments.pointsSnapshot` guarda os pontos do serviço no momento da reserva. Concluir usa esse número, não o `services.points` atual.

`PATCH /appointments/:id/complete`, na mesma transação e com `SELECT … FOR UPDATE` na linha do agendamento:

1. recusa se o status não é `CONFIRMED`;
2. grava `COMPLETED` e `completedAt`;
3. se `pointsSnapshot > 0`, insere um `EARN` com `earnAppointmentId` igual ao agendamento.

Serviço com zero pontos conclui sem movimentação. Cancelar e `NO_SHOW` não geram pontos. `COMPLETED` não volta para `CANCELLED` e não há estorno nesta fase.

A unicidade é `(tenantId, earnAppointmentId)`. Só o `EARN` preenche essa coluna. Vários ajustes e futuros resgates continuam possíveis, porque a coluna fica nula e o MySQL permite várias nulas no índice único. MySQL não deixa um `CHECK` citar `appointmentId` enquanto essa coluna tem ação de foreign key, então a igualdade `appointmentId = earnAppointmentId` fica na gravação do serviço.

O lock da conclusão é só o agendamento. Não trava o cliente inteiro. Uma segunda conclusão espera o lock, vê `COMPLETED` e responde 409 `A transição de status não é permitida.` Se a unique estourar, a transação desfaz o `COMPLETED` e a resposta também é 409, não 500.

## Saldo e débito

`GET /api/v1/points/me` devolve `{ "balance": 120 }` para o `CLIENT` da sessão.

O débito administrativo trava a linha do cliente:

`prisma.$transaction`, isolamento `ReadCommitted`, timeout de 10 segundos, `SELECT id FROM clients WHERE id = ? AND tenantId = ? FOR UPDATE`.

O saldo é lido depois do lock. Se não cobre o débito, a resposta é 409 `Saldo de pontos insuficiente.` e nenhuma linha é criada. Outro débito do mesmo cliente espera essa linha. Dois débitos de 80 com saldo 100 deixam saldo 20. Créditos de atendimento não entram nessa fila: eles só aumentam o saldo. Timeout de lock ou deadlock vira 409 `Não foi possível concluir a movimentação de pontos.`

O isolamento global do MySQL não muda.

## Rotas

| Método | Rota | Quem |
| ------ | ---- | ---- |
| GET | `/api/v1/points/me` | CLIENT |
| GET | `/api/v1/points/me/transactions` | CLIENT. `page`, `pageSize`, `createdAt` descendente |
| GET | `/api/v1/clients/:id/points` | ADMIN. Saldo, créditos, débitos e última movimentação |
| GET | `/api/v1/clients/:id/points/transactions` | ADMIN |
| POST | `/api/v1/clients/:id/points/adjustments` | ADMIN. Só os dois tipos de ajuste, motivo obrigatório |

Cliente de outro tenant responde 404. PROFESSIONAL não consulta extrato administrativo e não ajusta. O cliente não envia `clientId`, `newBalance` nem `createdByUserId`.

## PWA

`/conta` mostra os pontos disponíveis e o link do extrato. `/pontos` lista data, tipo, motivo e o sinal. `/admin/clients/:id/points` mostra saldo, extrato e o ajuste. No débito, a tela estima o saldo seguinte; o valor gravado é o que o backend recalcula.

## Fora desta fase

Catálogo de recompensas, troca de pontos por serviço, desconto, cupom, expiração, pagamento, financeiro, comissão, PIX, cartão, WhatsApp e notificação não existem. `REDEEM` está no domínio para essa fase seguinte.
