# Agenda e disponibilidade

A agenda pertence ao profissional. O serviço só entra no cálculo pela duração. Esta fase não cria agendamento, reserva, confirmação, pagamento, cancelamento, reagendamento, saldo de pontos, comissão ou notificação.

O futuro aplicativo mobile do Ravion Barber será desenvolvido em Flutter utilizando Dart e consumirá a mesma REST API utilizada pela aplicação PWA. O contrato é o OpenAPI em `/api/docs`.

## Dia da semana

`dayOfWeek` é um inteiro, não um nome livre.

| Valor | Dia      |
| ----- | -------- |
| 1     | segunda  |
| 2     | terça    |
| 3     | quarta   |
| 4     | quinta   |
| 5     | sexta    |
| 6     | sábado   |
| 7     | domingo  |

## Horário de parede

`ProfessionalSchedule.startTime` e `endTime` são `CHAR(5)` no formato `HH:mm`. Não carregam data. O mesmo vale para o horário opcional de uma exceção. A data da exceção é `CHAR(10)` `YYYY-MM-DD`, não um `Date` do Prisma, para o dia civil não escorregar por causa de meia-noite em UTC.

`startTime` precisa ser anterior a `endTime`. `08:00 → 08:00` e `12:00 → 08:00` são rejeitados. Vários intervalos no mesmo dia são permitidos. Intervalos que se encostam, como `08:00–12:00` e `12:00–18:00`, são válidos. Sobreposição, inclusive intervalos idênticos, responde 400 com `Os intervalos se sobrepõem.` A validação acontece na aplicação antes da transação. Um corpo inválido não apaga a semana já gravada.

`PUT` substitui a semana inteira daquele profissional. Um dia sem intervalo fica fechado. A linha de agenda é configuração, não histórico. Um agendamento futuro deve guardar o próprio instante e não apontar para essas linhas.

## Timezone

A timezone da agenda é `America/Sao_Paulo`, offset fixo `−03:00` desde 2019. Não existe configuração por tenant nesta fase. A conversão fica em `apps/api/src/common/time/schedule-clock.ts`. O fuso do navegador não é fonte da verdade.

Um bloqueio sem fuso no texto é lido como `America/Sao_Paulo`. Um valor com `Z` ou offset é respeitado. A resposta devolve o instante nesse fuso, com offset explícito, por exemplo `2026-10-05T12:00:00-03:00`.

## Bloqueios

`ProfessionalTimeBlock` guarda `startAt` e `endAt` como `DateTime`. O bloqueio é um período em que o profissional não atende: almoço, compromisso, folga ou férias.

Sobreposição é rejeitada, não mesclada. A mensagem é `Os bloqueios se sobrepõem.`

Dia inteiro, na interface, vai de `00:00:00-03:00` até `23:59:59-03:00` da data escolhida. A comparação de sobreposição usa o intervalo `[início, fim)`.

`DELETE` remove a linha. Bloqueio é configuração, não histórico de atendimento.

## Exceções

`ProfessionalScheduleException` não é um bloqueio. O tipo é `BLOCK` ou `OPEN`.

- `OPEN` acrescenta um período que a semana não tem. Um sábado fechado pode abrir das `08:00` às `14:00`.
- `BLOCK` retira um período da semana. Cobrir o expediente inteiro deixa o dia sem horários.

`startTime` e `endTime` nulos, ou omitidos, significam o dia inteiro, das `00:00` até a meia-noite seguinte, fim exclusivo. Os dois horários precisam vir juntos. Sobreposição no mesmo dia é rejeitada, qualquer que seja o tipo.

## Ordem do cálculo

`calculateAvailability` concentra a regra. Controllers não recalculam slot.

1. Janelas do dia na agenda semanal.
2. Exceções `OPEN`, somadas e unidas às janelas.
3. Exceções `BLOCK`, subtraídas.
4. Bloqueios da data, recortados ao dia local.
5. Ocupações futuras. Nesta fase a lista vai vazia.
6. Geração dos horários de início.

O passo dos slots é `SLOT_STEP_MINUTES = 15`. Ele não precisa ser igual à duração do serviço e não aparece na resposta.

Um início só existe se `início + duração <= fim da janela`. A duração vem de `Service.durationMinutes`. O atendimento não pode começar dentro de um bloqueio, terminar dentro dele nem atravessá-lo. Isso sai da subtração: a janela é cortada antes de gerar os horários. Exemplo: expediente `08:00–18:00`, bloqueio `12:00–13:30`, serviço de 60 minutos. `11:30` não aparece, porque `11:30–12:30` não cabe na janela que termina às `12:00`.

Corte de 30 minutos em `08:00–12:00` produz `08:00`, `08:15`, … `11:30`. `11:45` e `12:00` ficam de fora.

## Disponibilidade

`GET /api/v1/professionals/:id/availability?date=YYYY-MM-DD&serviceId=UUID`

A resposta é somente:

```json
{
  "date": "2026-10-05",
  "professionalId": "...",
  "serviceId": "...",
  "durationMinutes": 30,
  "slots": ["08:00", "08:15"]
}
```

Uma data por requisição. Não há `startDate` nem `endDate`.

- Data fora de `YYYY-MM-DD`, ou impossível, responde 400 `Data inválida.`
- Data anterior a hoje em `America/Sao_Paulo` responde 200 com `slots: []`. O dia de hoje pode incluir horários que já passaram.
- Profissional de outro tenant, inexistente ou com `isActive = false` responde 404 `Recurso não encontrado`, para qualquer papel, inclusive ADMIN. A agenda desse profissional ainda pode ser editada por um ADMIN, para configurar antes de reativar.
- Serviço de outro tenant, inexistente ou inativo responde 404 para CLIENT, PROFESSIONAL e ADMIN.

A consulta é leitura. Não reserva o horário e não exige um agendamento anterior.

## Quem altera

| Operação                         | PROFESSIONAL próprio | ADMIN do tenant | CLIENT |
| -------------------------------- | -------------------- | --------------- | ------ |
| Consultar disponibilidade       | sim                  | sim             | sim    |
| Consultar e substituir a semana  | a própria            | qualquer um     | 403    |
| Bloqueios e exceções             | os próprios          | qualquer um     | 403    |

`PROFESSIONAL` não usa a rota administrativa nem para o próprio id. Outro tenant responde 404, mesmo com o UUID conhecido. `tenantId` no corpo é rejeitado.

Rotas `me/...` ficam registradas antes de `:id/...`.

## Fase 05

`calculateAvailability` aceita `occupied`. A Fase 05 deve passar os agendamentos confirmados ali, sem reescrever o motor. Esta fase não cria tabela de appointment, não reserva e não trava o banco. A consulta de disponibilidade não impede duas escolhas simultâneas. A proteção contra dupla reserva entra na gravação do agendamento, na fase seguinte.
