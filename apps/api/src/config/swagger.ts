import { DocumentBuilder, type OpenAPIObject } from '@nestjs/swagger';
import { ApiErrorResponseDto } from '../common/dto/api-error.response';
import { PaginationMetaDto } from '../common/dto/pagination-meta.response';
import { PaginationQueryDto } from '../common/dto/pagination.query';

export const API_DESCRIPTION = `API HTTP da plataforma Ravion Barber.

Clientes:
- PWA web em React, Vite e TypeScript.
- Aplicativo mobile futuro em Flutter, utilizando Dart, consumindo esta mesma API.

Não existe backend separado por cliente. As regras de negócio permanecem nesta API e o contrato compartilhado é HTTP/OpenAPI, adequado para manter clientes TypeScript e Dart/Flutter.

Convenções:
- Rotas versionadas em /api/v1.
- Erros seguem ApiErrorResponseDto: statusCode, message e error. A resposta não inclui stack trace.
- O access token é um JWT no cabeçalho Authorization (esquema bearer) ou no cookie HttpOnly ravion_access. Health e o cadastro/login/refresh/logout são públicos.
- O login exige o header X-Tenant-Slug. Esse slug escolhe o contexto lógico da aplicação. Não é uma barbearia e não substitui o papel do usuário.
- Depois da autenticação, o tenant vem do token e do usuário no banco. Um tenantId no corpo não autoriza acesso a outro contexto.
- Papéis: CLIENT, PROFESSIONAL e ADMIN. O cadastro público cria User e Client na mesma transação. Professional só nasce por um ADMIN.
- Cliente, profissional e serviço pertencem ao tenant da sessão. tenantId enviado pelo cliente não autoriza outro contexto.
- Serviço guarda preço decimal, duração, pontos ganhos na conclusão e, separadamente, pontos necessários para resgate. O agendamento pode ser NORMAL ou POINTS. POINTS debita o ledger na mesma transação. Cancelar devolve esses pontos com REDEEM_REVERSAL. O preço em reais não é pagamento: dinheiro, PIX e cartão ficam fora da aplicação.
- GET /api/v1/admin/dashboard resume um dia civil em America/Sao_Paulo para o ADMIN do tenant da sessão. O resumo conta os status do dia. totals traz clientes do tenant e profissionais e serviços ativos. upcoming lista até cinco inícios futuros em PENDING ou CONFIRMED. O valor dos serviços é a soma de priceSnapshot. Não há caixa, pagamento nem comissão.
- GET /api/v1/professionals/me/dashboard resume o dia do PROFESSIONAL autenticado, na mesma timezone. O profissional sai da sessão. Não há comissão nem pagamento.
- GET e PATCH /api/v1/settings são do ADMIN e usam o tenant da sessão. O corpo só aceita chaves do contrato. business_hours guarda o horário do estabelecimento em JSON. Quando essa chave existe, a disponibilidade do profissional é a interseção com esse horário. Sem a chave, a agenda do profissional segue como antes. booking_min_advance_minutes e cancellation_min_advance_minutes são inteiros de 0 a 43200. Sem a linha, valem 0 e não restringem. A antecedência de cancelamento vale só para o CLIENT. appointment_buffer_minutes é um inteiro de 0 a 240 reservado depois de cada atendimento. Sem a linha, vale 0. O serviço continua cabendo na jornada e no horário do estabelecimento; o buffer não entra na duração. booking_max_advance_days é um inteiro de 0 a 365. Sem a linha, vale 0 e não limita a data. Com valor positivo, a data local em America/Sao_Paulo pode ser hoje mais esses dias, inclusive, e o dia seguinte fica sem horários. A mesma janela vale na criação. Valores desta tabela não são segredos.
- Listagens aceitam page e pageSize. O filtro isActive é específico de clientes, profissionais e serviços. A listagem de clientes também aceita search, um trecho do nome ou do e-mail, e ordena por nome e id. GET /api/v1/clients/:id/overview reúne cadastro, saldo do ledger, resumo de atendimentos, até cinco próximos e até cinco do histórico. A listagem de profissionais aceita search no nome de exibição, no nome da conta ou no e-mail, filtra isActive e ordena por nome de exibição e id. GET /api/v1/professionals/:id/overview reúne cadastro, catálogo de serviços do tenant, jornada semanal ativa, resumo de atendimentos, até cinco próximos e até cinco do histórico. Hoje usa o dia civil em America/Sao_Paulo.
- O envelope de paginação é { data, meta }, com meta em PaginationMetaDto. Serviços seguem createdAt descendente. Clientes seguem nome e id. Profissionais seguem nome de exibição e id.`;

export const swaggerModels = [ApiErrorResponseDto, PaginationQueryDto, PaginationMetaDto];

export function buildSwaggerConfig(port: number): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('Ravion Barber API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0.0')
    .addServer(`http://127.0.0.1:${port}`)
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token JWT enviado em Authorization. O mesmo esquema vale para o PWA e para o futuro aplicativo Flutter.',
      },
      'bearer',
    )
    .addTag('health', 'Disponibilidade da API')
    .addTag('auth', 'Cadastro, sessão e usuário autenticado')
    .addTag('users', 'Usuários do tenant autenticado')
    .addTag('clients', 'Perfil operacional de clientes')
    .addTag('professionals', 'Perfil operacional de profissionais e o dia do profissional autenticado')
    .addTag('schedule', 'Agenda semanal, bloqueios, exceções e disponibilidade')
    .addTag('services', 'Catálogo de serviços')
    .addTag('appointments', 'Agendamentos e proteção contra dupla reserva')
    .addTag('dashboard', 'Visão operacional do dia para o administrador')
    .addTag('points', 'Ledger de pontos e saldo do cliente')
    .build();
}

function errorContent(description: string): {
  description: string;
  content: { 'application/json': { schema: { $ref: string } } };
} {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ApiErrorResponseDto' },
      },
    },
  };
}

export function applyOpenApiConventions(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.parameters = {
    ...document.components.parameters,
    Page: {
      name: 'page',
      in: 'query',
      description: 'Página da listagem, começando em 1.',
      required: false,
      schema: { type: 'integer', minimum: 1, default: 1 },
    },
    PageSize: {
      name: 'pageSize',
      in: 'query',
      description:
        'Quantidade de itens por página. Filtros de negócio entram como query params próprios de cada recurso.',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  };

  document.components.responses = {
    ...document.components.responses,
    BadRequest: errorContent('Requisição inválida.'),
    Unauthorized: errorContent('Autenticação ausente ou inválida.'),
    Forbidden: errorContent('Cliente autenticado sem permissão para a operação.'),
    NotFound: errorContent('Recurso não encontrado.'),
    TooManyRequests: errorContent('Limite de requisições excedido.'),
    InternalServerError: errorContent('Falha inesperada. A resposta não inclui stack trace.'),
  };

  return document;
}
