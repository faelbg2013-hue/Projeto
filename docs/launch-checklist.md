# Checklist de publicação

Este documento prepara o primeiro deploy público. Não homologa domínio, certificado nem HTTPS real. Esses três itens continuam obrigatórios antes de tratar o serviço como lançado.

Os procedimentos de migration, bootstrap, backup e restore estão em [production-operations.md](production-operations.md). Não use `prisma migrate reset`, `prisma db push` nem o seed de desenvolvimento.

## Antes da publicação

| Item | Como verificar | Aprovado quando |
| --- | --- | --- |
| Infraestrutura provisionada | Conferir servidor, Docker e as redes `edge` e `data` do Compose de produção. O MySQL não publica porta no host. | Os serviços previstos existem e o volume `ravion_production_mysql` está nomeado, sem reutilizar o volume de desenvolvimento. |
| Domínio definido | O operador informa o domínio fora deste repositório. | O domínio está decidido e não é `localhost`. Este repositório não escolhe o nome. |
| DNS configurado | Consultar o DNS público do domínio. | O nome aponta para o equipamento que termina o TLS. |
| HTTPS válido | Abrir a origem com um cliente que recuse certificado autoassinado. | A cadeia é pública, o nome confere e a validade cobre a data da publicação. Um ensaio com certificado local não conta. |
| Segredos gerados | Conferir o shell ou o arquivo não versionado. Comparar com `.env.example` e com `deploy/env.production.example`. | `JWT_SECRET` e `JWT_REFRESH_SECRET` têm pelo menos 32 caracteres, são diferentes entre si e diferentes dos placeholders de desenvolvimento. As senhas do MySQL não são as de desenvolvimento. Nenhum desses valores está no Git. |
| Backup configurado | Seguir a seção Backup de `production-operations.md` num banco que não seja o de desenvolvimento. | Um dump é gerado sem senha na linha de comando, copiado para fora do servidor e removido do container. A retenção prevista é diária, com 7 diários, 4 semanais e 3 mensais. |
| Variáveis revisadas | `docker compose -f docker-compose.production.yml config` com o ambiente do operador. | `PUBLIC_ORIGIN` é a origem HTTPS do domínio. `TRUST_PROXY` é `1`, ou `2` se houver outro balanceador. `SWAGGER_ENABLED` permanece `false`. `NODE_ENV` da API é `production`. |
| Banco inicializado | Num banco vazio e exclusivo, o serviço `migrate` executa `prisma migrate deploy`. | As migrations já versionadas ficam aplicadas. Não há migration nova nesta fase. O seed não roda. |
| ADMIN criado manualmente | Depois do banco migrado, `pnpm admin:bootstrap` num terminal interativo. | O comando pede a senha duas vezes, sem eco, e não recebe senha por argumento nem por variável. A consulta posterior mostra um `ADMIN` ativo no tenant, sem imprimir `passwordHash`. Uma segunda execução não troca a senha. |
| CI e E2E aprovados | Ver os jobs `ci` e `e2e` no GitHub Actions do commit que será publicado. | O CI automático está verde e a matriz Playwright das cinco resoluções passou no banco isolado. |

## Durante a publicação

| Item | Como verificar | Aprovado quando |
| --- | --- | --- |
| Aplicar migrations de produção | Deixar o serviço `migrate` concluir antes da API. O comando é `prisma migrate deploy`, pela imagem de runtime. | O container termina com sucesso e não usa `migrate dev`, `db push` nem `migrate reset`. |
| Iniciar serviços | `docker compose -f docker-compose.production.yml -f docker-compose.production.tls.yml --profile tls up --build`, com `TLS_CERT_DIR` fora do repositório. | API, PWA, proxy TLS e MySQL ficam em execução. O volume de dados não é recriado. |
| Validar healthchecks | `GET /api/v1/health/live` e `GET /api/v1/health/ready` pela origem pública. | Os dois respondem 200 com `status` e `service` apenas. A prontidão não devolve host, usuário nem connection string. |
| Validar Nginx | Conferir `/` e `/api/v1/health/live` no mesmo host. | `/` entrega o PWA. `/api/` chega à API. O PWA interno responde 404 para `/api/`. |
| Confirmar HTTPS | Abrir a origem pública e o listener da porta 80 do domínio. | A origem usada pelo navegador é `https`. A porta HTTP pública redireciona para `https` no equipamento de borda. `HTTP_PORT` deste Compose não fica exposto na internet. HSTS aparece só na resposta HTTPS do PWA. |
| Confirmar acesso ao PWA | Abrir a raiz no navegador. | O HTML do Ravion Barber carrega e o bundle não contém `http://127.0.0.1:43111`. |
| Confirmar login ADMIN | Entrar com o administrador criado no bootstrap. | O login conclui e a área administrativa abre. |
| Confirmar cookies seguros | Inspecionar `Set-Cookie` de um login com `tokenDelivery: cookie` em HTTPS. | `ravion_access` tem `Path=/api`. `ravion_refresh` tem `Path=/api/v1/auth`. Os dois são `HttpOnly`, `Secure` e `SameSite=Lax`. O JSON desse modo não traz `accessToken` nem `refreshToken`. |
| Verificar logs e persistência | Ler o log da API e reiniciar só o container da API. | O log não mostra senha, JWT nem `DATABASE_URL`. Depois do reinício, `GET /api/v1/health/ready` continua 200 e os dados do volume permanecem. |

## Depois da publicação

| Item | Como verificar | Aprovado quando |
| --- | --- | --- |
| Testar cadastro CLIENT | Criar uma conta pela tela pública. | O usuário nasce `CLIENT` no tenant de `DEFAULT_PUBLIC_TENANT_ID`. Um `tenantId` enviado pelo navegador não escolhe outro tenant. |
| Testar login PROFESSIONAL | Entrar com um profissional criado pelo ADMIN. | A área do profissional abre e a área administrativa não abre com essa sessão. |
| Testar agendamento | O cliente agenda em modo normal e, se houver saldo, em modo pontos. | Os dois horários aparecem para o profissional e para o administrador do mesmo tenant. |
| Testar conclusão e pontos | O profissional conclui um atendimento com pontos. | O status fica concluído e o ledger ganha um único crédito. Uma segunda conclusão não credita de novo. |
| Testar cancelamento e reversão | Cancelar um atendimento que já tenha movimento de pontos, dentro da regra vigente. | O status e o saldo seguem a regra já homologada. `NO_SHOW` não credita pontos. |
| Testar logout | Sair pela interface. | A sessão é revogada, os cookies são limpos e uma rota autenticada volta a pedir login. O refresh antigo não renova a sessão. |
| Verificar responsividade | Abrir o PWA em 360×800, 390×844, 768×1024, 1024×768 e 1440×900. | Não há overflow horizontal nas telas de conta, agenda e administração. |
| Confirmar backup | Gerar um backup novo depois dos testes de negócio. | O arquivo sai do servidor e a senha não aparece no comando. |
| Confirmar recuperação documentada | Restaurar esse backup num banco temporário vazio, nunca por cima do banco em uso. | `migrate deploy` não mostra migration pendente e `GET /api/v1/health/ready` responde 200 nesse banco temporário. |
| Verificar logs e alertas | Revisar API, proxy e MySQL depois dos testes. | Não há stack de erro entregue ao cliente. O operador sabe onde ler falha de healthcheck e falha de disco do volume. |

## Rollback

Preserve o volume `ravion_production_mysql`. Não apague volumes para voltar uma versão.

| Tipo | O que fazer | O que não fazer |
| --- | --- | --- |
| Imagem da API | Subir de novo a tag anterior de `ravion-barber-api`, depois de o MySQL saudável estar no ar. | Não acompanhar a imagem antiga com uma migration invertida automática. |
| Imagem do PWA | Subir de novo a tag anterior de `ravion-barber-web`. O build continua com `VITE_API_URL` vazio. | Não apontar o navegador para `localhost`. |
| Configuração | Restaurar o ambiente não versionado anterior (`PUBLIC_ORIGIN`, segredos, `TRUST_PROXY`, `TLS_CERT_DIR`) e recriar os containers sem `--volumes`. | Não copiar segredo para o Git para “desfazer”. |
| Migration | Se a versão nova ainda não migrou, a imagem anterior volta direto. Se `migrate deploy` já aplicou uma migration compatível, mantenha o schema e volte só as imagens que leem esse schema. Se a migration for incompatível ou tiver apagado dado, restaure o backup num banco novo e aponte a versão anterior para esse banco. | Não executar `prisma migrate reset`, `prisma db push` nem down migration destrutiva no banco em uso. |

Uma falha no meio da subida para na migration ou no healthcheck. O volume permanece. Corrija a configuração ou volte a imagem anterior; não recrie o volume para limpar o erro.

## O que esta fase não fecha

Não há domínio, certificado público nem homologação HTTPS neste repositório. O redirect HTTP para HTTPS é obrigação do equipamento que publica a porta 443, porque o nginx de TLS deste projeto não escuta a porta 80.
