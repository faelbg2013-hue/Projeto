# Painel operacional

O administrador consulta um dia civil da barbearia em `GET /api/v1/admin/dashboard`. A rota é somente `ADMIN`. `CLIENT` e `PROFESSIONAL` recebem 403. O tenant sai da sessão. `tenantId` na query é rejeitado. Profissional de outro tenant responde 404, `Recurso não encontrado`.

A data é `YYYY-MM-DD` em `America/Sao_Paulo`. Sem `date`, a API usa o dia atual nessa timezone, não o fuso do navegador. Uma data inválida responde 400. Uma data passada válida responde normalmente. Não há intervalo de datas.

`professionalId` restringe o dia inteiro. `status` filtra só a lista `appointments`. O resumo, os próximos atendimentos e a visão por profissional continuam o dia completo, já limitado pelo profissional quando ele foi informado.

O resumo conta agendamentos `CONFIRMED`, `COMPLETED`, `CANCELLED` e `NO_SHOW` e soma `priceSnapshot`. Esse total se chama valor dos serviços. Não é pagamento, caixa nem receita recebida. Pontos utilizados somam `REDEEM` ligados aos agendamentos do dia. Pontos devolvidos somam `REDEEM_REVERSAL`. Pontos concedidos somam `EARN`. O saldo do cliente não é recalculado aqui e não existe `pointsBalance`.

Próximos atendimentos são os `PENDING` e `CONFIRMED` do dia, em `startAt` ascendente. `COMPLETED`, `CANCELLED` e `NO_SHOW` ficam de fora. `POINTS` expõe `redemptionPointsSnapshot`. `NORMAL` deixa esse campo nulo. Nome, duração e preço vêm do snapshot do agendamento. Alterar o serviço depois não muda o painel.

A visão por profissional lista quem teve atendimento no dia, com quantidade, concluídos, cancelados, não comparecimento e valor dos serviços. Não há comissão, salário, ranking nem avaliação.

A lista do dia traz o necessário para as transições que já existem: concluir, não compareceu e cancelar. O painel não cria transição nova. O PWA está em `/admin/dashboard`, com atualização manual. Não há WebSocket nem notificação.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.
