# Resgate de pontos no agendamento

O cliente escolhe, na hora de agendar, se o horário segue o valor cadastrado do serviço ou se usa pontos. As duas coisas acontecem na mesma transação do agendamento.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA.

## O que não é pagamento

O Ravion Barber não processa pagamentos. Não há PIX, cartão, dinheiro, gateway, checkout nem status de pagamento. `services.price` e `appointments.servicePriceSnapshot` guardam o preço cadastrado do serviço. Quando o cliente escolhe o modo normal, o pagamento desse valor acontece fora da aplicação. Quando escolhe pontos, o sistema só registra o resgate.

## Dois números no serviço

`points` é o que o cliente ganha ao concluir o atendimento.

`redemptionPoints` é o que o cliente gasta para agendar naquele serviço. `null` significa que o resgate não está disponível. Inteiro maior que zero habilita a opção. Zero, negativo e decimal são rejeitados.

Um corte pode gerar 10 pontos e custar 50 para ser resgatado. Os campos não se substituem.

## O que fica no agendamento

`bookingMode` é `NORMAL` ou `POINTS`. Não é forma de pagamento.

`redemptionPointsSnapshot` copia `redemptionPoints` quando o modo é `POINTS`. No modo normal fica `null`.

`pointsSnapshot`, preço, nome e duração continuam sendo o serviço relido na criação. Uma alteração posterior do serviço não muda o agendamento nem a devolução.

O cliente envia apenas `bookingMode`. Quantidade, preço, duração e pontos ganhos vêm do serviço no servidor.

## Débito

`NORMAL` não cria `REDEEM` e não muda o saldo.

`POINTS` trava a linha do cliente e depois a linha do profissional, dentro de `prisma.$transaction` com `ReadCommitted` e timeout de 10 segundos:

1. relê cliente, profissional e serviço;
2. recusa serviço sem `redemptionPoints`;
3. confirma que o horário ainda existe;
4. cria o agendamento;
5. se o saldo não cobre o custo, responde 409 `Saldo de pontos insuficiente.`;
6. insere um `REDEEM` com `redeemAppointmentId` igual ao agendamento.

Se o horário estiver ocupado, não há agendamento e não há `REDEEM`. Se o `REDEEM` falhar, o agendamento também não permanece. A unique `(tenantId, redeemAppointmentId)` impede um segundo resgate daquele agendamento. A `Idempotency-Key` repetida devolve o mesmo agendamento e não debita de novo.

Dois pedidos `POINTS` do mesmo cliente esperam a linha do cliente. Com saldo para um só, o segundo recebe 409 e o saldo não fica negativo. Isso vale para horários diferentes e para profissionais diferentes. Dois pedidos no mesmo horário também deixam um único agendamento.

O isolamento global do MySQL não muda.

O motivo do débito é `Resgate de pontos no agendamento do serviço {nome}`.

## Conclusão, falta e cancelamento

Concluir continua gerando um `EARN` com `pointsSnapshot`, mesmo quando o agendamento usou pontos. Um corte resgatado por 50 e concluído com snapshot 10 sai de 100 para 50 e depois para 60.

`NO_SHOW` não devolve os pontos e não gera `EARN`. Os pontos reservaram o horário.

Cancelar um `CONFIRMED` com `bookingMode` `POINTS` trava o agendamento e cria um `REDEEM_REVERSAL` apontando para o `REDEEM` original. A quantidade é a do resgate, não o `redemptionPoints` atual do serviço. O ledger antigo não é editado. `reversalOfTransactionId` é único, então o mesmo resgate não é devolvido duas vezes. Um segundo cancelamento simultâneo espera o lock, vê `CANCELLED` e responde 409.

`NORMAL` cancelado não movimenta pontos. `COMPLETED` não pode ser cancelado e portanto não gera devolução.

Cliente, profissional do atendimento e administrador do tenant seguem as mesmas regras de cancelamento já existentes.

## Permissões

O `CLIENT` agenda só para si. O `PROFESSIONAL` vê se o horário usou pontos e não cria, altera ou devolve pontos por uma rota própria. O ajuste administrativo continua restrito a `ADJUSTMENT_CREDIT` e `ADJUSTMENT_DEBIT`. `EARN`, `REDEEM` e `REDEEM_REVERSAL` não entram por esse endpoint.

Outro tenant responde 404.

## PWA

`/agendar` mostra o saldo, o preço e, quando o serviço tem resgate, a escolha entre pagar normalmente e usar pontos. Saldo insuficiente desabilita a opção. A confirmação mostra o saldo seguinte só como prévia. `/agendamentos` mostra quantos pontos foram utilizados. O extrato mostra o resgate com sinal negativo e a devolução com sinal positivo.
