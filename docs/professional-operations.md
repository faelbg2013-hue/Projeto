# Operação do profissional

O profissional autenticado acompanha o próprio dia em `/profissional` e `/profissional/agenda`. O horário semanal, os bloqueios e as exceções continuam em `/profissional/agenda/semana` e nas rotas já existentes de agenda. Não há migration nesta área: o dia lê `appointments`, `clients`, `services` e o profissional da sessão.

## API

`GET /api/v1/professionals/me/dashboard?date=YYYY-MM-DD`

- Somente `PROFESSIONAL`. `CLIENT` e `ADMIN` recebem 403.
- O tenant e o profissional saem da sessão. `professionalId` na query é rejeitado.
- A data é um dia civil em `America/Sao_Paulo`. Sem o parâmetro, vale hoje nessa timezone. Data inválida responde 400 com `Data inválida.`
- Uma consulta devolve o resumo (`total`, `confirmed`, `completed`, `noShow`, `cancelled`), o próximo `CONFIRMED` com `startAt` futuro, o `CONFIRMED` cujo intervalo contém o instante atual e a lista do dia.
- `COMPLETED`, `CANCELLED` e `NO_SHOW` não entram como próximo atendimento.
- O preço é `priceSnapshot`, string decimal. Não é pagamento. Não há comissão.
- `bookingMode = POINTS` devolve `redemptionPointsSnapshot`. `NORMAL` devolve `null`.
- A descrição do serviço, quando existe, é a descrição atual do catálogo. Nome, duração, preço e pontos continuam os snapshots do agendamento.
- A resposta não inclui e-mail, `passwordHash`, token nem hash de sessão.

Concluir, marcar falta e cancelar continuam em:

- `PATCH /api/v1/appointments/:id/complete`
- `PATCH /api/v1/appointments/:id/no-show`
- `PATCH /api/v1/appointments/:id/cancel`

O profissional só alcança os próprios agendamentos. Outro profissional ou outro tenant segue 404 `Recurso não encontrado`. Transição inválida segue 409 `A transição de status não é permitida.` O PWA mostra essa mensagem e não trata o 409 como sucesso.

Bloqueio de horário reutiliza `POST` e `DELETE /api/v1/professionals/me/time-blocks`. A regra de sobreposição não muda.

## Pontos

O frontend não calcula saldo e não grava lançamento. `EARN` continua na conclusão, `REDEEM` no agendamento `POINTS` e `REDEEM_REVERSAL` no cancelamento `POINTS`. `NO_SHOW` não gera `EARN` e não devolve pontos. O profissional não ajusta o ledger.

## Fora desta área

Pagamento, PIX, cartão, dinheiro, desconto, cupom, comissão, WhatsApp e notificação externa não existem aqui.
