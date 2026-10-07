# Autenticação e tenant

O tenant é o contexto lógico de uma aplicação dentro do ecossistema Ravion Barber. Ele não representa uma barbearia independente. O papel (`role`) é outra coisa: define o que o usuário pode fazer dentro daquele contexto.

```text
Ravion Barber
├── tenant web
│   ├── CLIENT
│   ├── PROFESSIONAL
│   └── ADMIN
└── tenant mobile
    ├── CLIENT
    ├── PROFESSIONAL
    └── ADMIN
```

Um usuário sempre pertence a um tenant. Usuários de contextos diferentes não consultam, alteram nem excluem dados uns dos outros, mesmo que conheçam o identificador do registro.

## De onde vem o tenant

O frontend não escolhe o tenant do usuário autenticado.

| Momento                | Fonte do tenant                                                    |
| ---------------------- | ------------------------------------------------------------------ |
| Cadastro público       | `DEFAULT_PUBLIC_TENANT_ID`, lida só no servidor                    |
| Login                  | header `X-Tenant-Slug`                                             |
| Requisição autenticada | claim `tenantId` do access token, conferida com o usuário no banco |

`POST /api/v1/auth/register` ignora qualquer tentativa de enviar `role` ou `tenantId`. O papel criado é sempre `CLIENT`. Campos extras são rejeitados pelo `ValidationPipe`. O cadastro cria o `User` e o perfil `Client` na mesma transação. Se o perfil não for gravado, o usuário também não permanece. O cadastro público não cria `Professional`.

As regras de acesso de cliente, profissional e serviço estão em [domain.md](domain.md).

`POST /api/v1/auth/login` procura o e-mail apenas no tenant do slug informado. O mesmo e-mail pode existir em outro tenant. Credencial errada, usuário inativo, tenant desconhecido ou tenant inativo respondem todos com:

```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "error": "Unauthorized"
}
```

Sem o header, a resposta é a mesma. Isso evita dizer se o e-mail existe.

O PWA envia `X-Tenant-Slug` com o valor de `VITE_TENANT_SLUG` (padrão `web`). O futuro aplicativo Flutter envia o slug do próprio contexto, por exemplo `mobile`, no mesmo header.

Depois do login, o slug não autoriza mais nada. O access token carrega só o necessário:

```json
{
  "sub": "user-id",
  "tenantId": "tenant-id",
  "role": "CLIENT"
}
```

Cada rota protegida recarrega o usuário. Se o usuário ou o tenant estiver inativo, ou se o `tenantId` do token não bater com o registro, a API responde `401`. O papel usado na autorização é o do banco.

Um corpo com `"tenantId": "outro-tenant"` não muda o contexto. Nas rotas de usuário, um id de outro tenant responde `404 Recurso não encontrado`, para não confirmar que o registro existe.

## Sessão

| Token   | Formato                       | Duração                                | Onde fica                            |
| ------- | ----------------------------- | -------------------------------------- | ------------------------------------ |
| Access  | JWT assinado com `JWT_SECRET` | `JWT_ACCESS_EXPIRES_IN` (padrão `15m`) | cookie `ravion_access` e corpo JSON  |
| Refresh | valor opaco de 32 bytes       | `JWT_REFRESH_EXPIRES_IN` (padrão `7d`) | cookie `ravion_refresh` e corpo JSON |

O banco guarda apenas o SHA-256 do refresh token, na tabela `user_sessions`, com usuário, tenant, expiração e revogação. A senha fica em Argon2id. `passwordHash` não sai nas respostas.

`POST /api/v1/auth/refresh` valida token, sessão, expiração, revogação, usuário e tenant ativos. A sessão antiga é revogada e uma nova é emitida.

`POST /api/v1/auth/logout` revoga essa sessão. O mesmo refresh não cria outra. O access token curto pode continuar válido até expirar; a renovação não.

`JWT_REFRESH_SECRET` continua obrigatório na configuração herdada da fundação. O refresh desta fase não é um JWT e não usa esse segredo. Em `NODE_ENV=production`, `JWT_SECRET` e `JWT_REFRESH_SECRET` precisam de um valor próprio: os placeholders do `.env.example` são recusados na subida da API. A aplicação não gera segredo automaticamente.

## PWA

O navegador fala com a API pela mesma origem. O Vite encaminha `/api` para `http://127.0.0.1:43111`. `VITE_API_URL` vazio é a configuração recomendada, inclusive em produção. Em desenvolvimento, a ausência da variável usa o endereço local. O build de produção não faz esse fallback: a variável precisa existir, vazia para a mesma origem ou com uma URL `https`. Localhost e HTTP absoluto são recusados.

Os cookies são `HttpOnly`, `SameSite=Lax` e `Secure` apenas em produção. O access cookie vale para `/api`. O refresh cookie vale para `/api/v1/auth`. O PWA manda `credentials: 'include'` e não grava token em `localStorage`.

A camada `apps/web/src/services/auth.service.ts` concentra `register`, `login`, `logout`, `refresh` e `me`. Os componentes não chamam esses endpoints. O serviço devolve só o usuário, descartando os tokens do JSON. Se `GET /auth/me` responder `401`, ele tenta o refresh pelo cookie.

Telas: `/login`, `/register` e, depois da sessão, `/conta`. A conta mostra nome, e-mail e perfil. O `tenantId` aparece só com o Vite em desenvolvimento, como diagnóstico, e some no build de produção.

## Flutter

Não há código Flutter nesta fase. O aplicativo futuro usa a mesma API e o OpenAPI em `/api/docs-json`.

O app guarda access e refresh no armazenamento seguro da plataforma, não em texto solto. Envia o access em `Authorization: Bearer`. No login, envia também `X-Tenant-Slug` do contexto daquele aplicativo. Não envia `tenantId` para escolher o contexto.

```http
POST /api/v1/auth/login
X-Tenant-Slug: mobile
Content-Type: application/json

{"email":"ana@example.com","password":"senha-segura"}
```

Resposta `200`:

```json
{
  "user": {
    "id": "...",
    "tenantId": "...",
    "name": "Ana Costa",
    "email": "ana@example.com",
    "role": "CLIENT",
    "isActive": true
  },
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900
}
```

| Operação      | Chamada                                                     |
| ------------- | ----------------------------------------------------------- |
| Renovar       | `POST /api/v1/auth/refresh` com `{ "refreshToken": "..." }` |
| Encerrar      | `POST /api/v1/auth/logout` com o refresh atual              |
| Usuário atual | `GET /api/v1/auth/me` com o bearer                          |
| Cadastro      | `POST /api/v1/auth/register` sem tenant e sem papel         |

O cadastro público usa o tenant configurado no servidor. Um aplicativo com outro contexto precisa de uma estratégia própria de provisionamento; não se resolve enviando `tenantId` no corpo.

Rotas de administrador exigem `role` `ADMIN`. `PROFESSIONAL` já autentica e passa pelo guard de papéis, mas não tem módulo próprio.

## Seed

`pnpm db:seed` cria, sem duplicar:

- o tenant de `TENANT_NAME`, `TENANT_SLUG` e `ADMIN_TENANT_ID`
- o administrador de `ADMIN_NAME`, `ADMIN_EMAIL` e `ADMIN_PASSWORD` nesse tenant

A senha não fica no código e não é impressa. Rodar de novo não cria outro tenant nem troca a senha já gravada. `ADMIN_PASSWORD` precisa ter no mínimo 12 caracteres. `DEFAULT_PUBLIC_TENANT_ID` deve ser o mesmo id do tenant público de desenvolvimento.
