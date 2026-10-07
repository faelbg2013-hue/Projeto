# Operação mínima de produção

Este caminho sobe a API e o PWA na mesma origem, aplica as migrations já versionadas e não cria schema novo. Não usa o Compose de desenvolvimento, não roda o seed e não executa `prisma migrate dev`.

O desenho público é:

```text
navegador
  → HTTPS
  → proxy (deploy/nginx)
  → /           PWA
  → /api/...    API
  → MySQL, só na rede interna
```

`https://dominio/` entrega o PWA. `https://dominio/api/...` entrega a API. `VITE_API_URL` vazio é a configuração desse desenho. Cookies `HttpOnly` e `SameSite=Lax` continuam válidos porque o navegador não troca de origem.

## Ordem do deploy

1. Disponibilizar configuração e segredos fora do Git. `JWT_SECRET` e `JWT_REFRESH_SECRET` precisam ter pelo menos 32 caracteres e não podem ser os placeholders de `.env.example`.
2. Confirmar que o MySQL 8 está acessível na rede interna.
3. Executar `pnpm db:migrate:deploy` (no Compose de produção, o serviço `migrate` faz isso).
4. Iniciar a nova versão da API com `node dist/main.js`.
5. Disponibilizar o PWA já compilado.
6. Verificar `GET /api/v1/health/ready`.
7. Fazer o smoke test abaixo.

Não executar `pnpm db:seed` em produção. O seed de desenvolvimento recusa `NODE_ENV=production` antes de abrir o banco. O primeiro tenant não é criado por este caminho.

## Migrations

| Ambiente | Comando | O que faz |
| --- | --- | --- |
| Desenvolvimento | `pnpm db:migrate` | `prisma migrate dev` |
| Produção e CI | `pnpm db:migrate:deploy` | `prisma migrate deploy` |

Em produção, não usar:

- `prisma migrate dev`
- `prisma db push`
- `prisma migrate reset`

`migrate deploy` aplica as migrations já existentes. Não gera migration e não apaga dados. Há 7 migrations. Esta fase não adiciona outra.

No Compose de produção, a migration roda num container de uso único, a partir do estágio de build da API, com o comando `prisma migrate deploy`. A imagem de runtime da API não migra na subida e não chama o seed.

## Imagens

`apps/api/Dockerfile` tem dois estágios. O estágio `build` instala o monorepo, gera o Prisma Client, compila a API e prepara as dependências de produção. O estágio `runtime` copia só esse resultado, usa o usuário `node` e executa `node dist/main.js`. Não usa `pnpm dev`, `nest start --watch`, seed nem `migrate dev`. Nenhum `.env` entra na imagem. A URL usada só para `prisma generate` no build é fictícia e não vai para o runtime.

`apps/web/Dockerfile` executa `vite build` com `VITE_API_URL` vazio e serve `apps/web/dist` com `nginxinc/nginx-unprivileged`, na porta 8080. Não usa o servidor de desenvolvimento do Vite. O processo do PWA não é root.

O proxy de borda usa `nginx:1.27-alpine` e escuta 80, ou 443 no perfil `tls`. Esse processo é root porque precisa da porta privilegiada. A API e o PWA ficam atrás dele.

`docker-compose.yml` continua sendo só o MySQL de desenvolvimento. Produção usa `docker-compose.production.yml`, o volume `ravion_production_mysql` e outro nome de projeto. Não publique a porta do MySQL.

Variáveis obrigatórias no shell, sem gravá-las no repositório:

- `MYSQL_ROOT_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `DEFAULT_PUBLIC_TENANT_ID`

`TRUST_PROXY` padrão desse Compose é `1`: o nginx deste repositório é o único proxy entre o cliente e a API. Se um balanceador externo também encaminhar o endereço do cliente, use `TRUST_PROXY=2`. O valor não está fixo no código. `true` continua recusado. Senha com `@`, `:`, `/` ou `?` precisa ir codificada na `DATABASE_URL`.

Subida local de validação, com segredos sintéticos só na sessão:

```bash
docker compose -f docker-compose.production.yml up --build
```

TLS no próprio nginx:

```bash
docker compose -f docker-compose.production.yml -f docker-compose.production.tls.yml --profile tls up --build
```

`TLS_CERT_DIR` aponta para um diretório externo com `fullchain.pem` e `privkey.pem`. Certificado e chave privada não entram no Git. Se o TLS terminar num balanceador à frente deste proxy, o listener público é o do balanceador, o HSTS fica lá, e este nginx HTTP não envia HSTS.

## HTTPS e headers do PWA

Produção pública usa HTTPS. O listener HTTP do Compose existe para verificação local e para o caso em que outro equipamento termina o TLS. HSTS só está em `deploy/nginx/proxy-tls.conf`.

O proxy aplica estes headers nas respostas do PWA, não nas da API. A API continua com Helmet.

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
- `Strict-Transport-Security` apenas no listener TLS

A CSP é:

```text
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self';
frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
```

Não usa `unsafe-eval` nem `unsafe-inline`. O PWA registra o service worker em `apps/web/src/main.tsx`, dentro do bundle. `injectRegister` fica `null` para o plugin não injetar um script inline. Fontes vêm do `@fontsource` empacotado. Há SVG em `data:` nos componentes, por isso `img-src` permite `data:`. Manifesto, service worker, assets e `fetch` para `/api` na mesma origem permanecem em `'self'`.

## Health

| Método e rota | Função | Banco |
| --- | --- | --- |
| `GET /api/v1/health/live` | Processo no ar | Não consulta |
| `GET /api/v1/health` | Alias de liveness | Não consulta |
| `GET /api/v1/health/ready` | Prontidão | `SELECT 1` |

Os três são públicos e ficam fora do rate limit. A resposta de sucesso é `{ "status": "ok", "service": "ravion-barber-api" }`. Se o `SELECT 1` falha, a rota de prontidão responde `503` com `Serviço indisponível`. A mensagem do driver, o host, o usuário e a `DATABASE_URL` não entram no JSON.

## Variáveis

| Variável | Quando | Uso |
| --- | --- | --- |
| `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DEFAULT_PUBLIC_TENANT_ID` | Runtime da API | Obrigatórias |
| `TRUST_PROXY` | Runtime da API | `false` no desenvolvimento. `1` com este proxy. `2` se houver outro hop |
| `THROTTLE_TTL_MS`, `THROTTLE_LIMIT` | Runtime da API | Limite geral. Padrão `60000` e `120` |
| `AUTH_THROTTLE_TTL_MS`, `AUTH_LOGIN_LIMIT`, `AUTH_REGISTER_LIMIT`, `AUTH_REFRESH_LIMIT` | Runtime da API | Limites de login, cadastro e refresh. Padrões `60000`, `10`, `5`, `30` |
| `CORS_ORIGINS`, `SWAGGER_ENABLED`, `LOG_LEVEL` | Runtime da API | Origem pública, documentação desligada em produção, log |
| `VITE_API_URL` | Build do PWA | Vazio para a mesma origem. Ausência, localhost e HTTP absoluto quebram o build de produção |
| `VITE_TENANT_SLUG` | Build do PWA | Slug enviado no login |
| `MYSQL_*` | Banco | Credenciais do servidor. Não versionar senha real |
| `ADMIN_PASSWORD` e demais `SEED_*` | Só desenvolvimento | O seed não roda em produção |

## Backup

O backup é lógico, com `mysqldump` do MySQL 8, e inclui schema e dados. Não excluir `Appointment`, `PointsTransaction`, `TenantSetting`, `User`, `UserSession` nem as demais tabelas do tenant. O ledger de pontos faz parte do backup.

A senha não vai na linha de comando. Dentro do container, grave um arquivo de cliente a partir da variável de ambiente, use esse arquivo e apague-o:

```bash
docker exec ravion-prod-mysql sh -c 'umask 077; printf "[client]\nuser=%s\npassword=%s\n" "$MYSQL_USER" "$MYSQL_PASSWORD" > /tmp/ravion-client.cnf; mysqldump --defaults-extra-file=/tmp/ravion-client.cnf --single-transaction --routines --triggers --default-character-set=utf8mb4 "$MYSQL_DATABASE" > /tmp/ravion-backup.sql; rm -f /tmp/ravion-client.cnf'
docker cp ravion-prod-mysql:/tmp/ravion-backup.sql ravion-backup.sql
docker exec ravion-prod-mysql rm -f /tmp/ravion-backup.sql
```

Para um MySQL fora do Docker, use um arquivo de cliente com permissão restrita, fora do repositório:

```ini
[client]
host=127.0.0.1
user=ravion
password=valor-fora-do-git
```

```bash
mysqldump --defaults-extra-file=/caminho/mysql-client.cnf --single-transaction --routines --triggers --default-character-set=utf8mb4 NOME_DO_BANCO > ravion-backup.sql
```

Guarde o arquivo fora do servidor da aplicação. Não o commite.

Retenção mínima recomendada: backup diário, conservar 7 diários, 4 semanais e 3 mensais. A política diária define o RPO máximo: até 24 horas de dados podem ficar de fora do último backup. O RTO não tem número prometido; meça o tempo no exercício de restauração.

## Restore

1. Criar um banco vazio e controlado. Não reutilizar o volume `ravion_mysql_data` nem apagar `ravion_barber` para ensaiar.
2. Restaurar o dump nesse banco.
3. Rodar `pnpm db:migrate:deploy` e confirmar que não há migration pendente.
4. Subir a API apontando para esse banco.
5. Verificar `GET /api/v1/health/ready`.
6. Smoke test da mesma origem.
7. Conferir contagens de tenants, usuários, sessões, agendamentos, lançamentos de pontos e configurações do tenant.

Pelo cliente com arquivo de credencial:

```bash
mysql --defaults-extra-file=/caminho/mysql-client.cnf -e "CREATE DATABASE nome_restaurado CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --defaults-extra-file=/caminho/mysql-client.cnf nome_restaurado < ravion-backup.sql
```

Pelo container, o arquivo de cliente também fica só dentro dele:

```bash
docker cp ravion-backup.sql ravion-prod-mysql:/tmp/ravion-backup.sql
docker exec ravion-prod-mysql sh -c 'umask 077; printf "[client]\nuser=%s\npassword=%s\n" "$MYSQL_USER" "$MYSQL_PASSWORD" > /tmp/ravion-client.cnf; mysql --defaults-extra-file=/tmp/ravion-client.cnf -e "CREATE DATABASE nome_restaurado CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"; mysql --defaults-extra-file=/tmp/ravion-client.cnf nome_restaurado < /tmp/ravion-backup.sql; rm -f /tmp/ravion-client.cnf /tmp/ravion-backup.sql'
```

Não rodar seed depois do restore.

## Smoke test

Pelo proxy:

- `/` responde o HTML do PWA.
- `/api/v1/health/live` responde 200.
- `/api/v1/health/ready` responde 200.
- Uma rota inexistente responde JSON `statusCode`, `message`, `error`, sem stack.
- Os headers de segurança do PWA estão presentes.
- O bundle não contém `http://127.0.0.1:43111`.
- Cookie de produção segue `HttpOnly`, `SameSite=Lax` e `Secure`. No listener HTTP local o cookie `Secure` não volta ao navegador; a sessão completa precisa de HTTPS.

## CI

`.github/workflows/ci.yml` roda em push e pull request para `main`. Usa Node 22, pnpm 10.33.3 e `pnpm install --frozen-lockfile`. O MySQL 8.4 do job é o banco `ravion_barber_ci`, com usuário e senha só de CI. `pnpm db:migrate:deploy` aplica as migrations. O seed não roda.

O job valida generate, validate, migrations, typecheck, lint, testes e build. O build do PWA grava `VITE_API_URL` vazio em `.env.production` dentro do runner.

`src/routes/auth-flow.spec.tsx` fica de fora apenas desse job. A falha conhecida é `AbortSignal` entre React Router, undici e jsdom. Nenhum outro teste de frontend é excluído, e a suíte local continua incluindo esse arquivo.

## O que a imagem não faz

- API não usa watch nem `pnpm dev`.
- PWA não usa `vite dev`.
- Prisma de produção não usa `migrate dev`.
- Seed não roda.
- Não há Kubernetes, Terraform, Helm nem recurso de um fornecedor de nuvem.
