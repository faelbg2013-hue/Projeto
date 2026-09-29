export interface HealthResponse {
  status: 'ok';
  service: 'ravion-barber-api';
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  error: string;
}

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface Paginated<TItem> {
  data: TItem[];
  meta: PaginationMeta;
}

const userRole = {
  CLIENT: 'CLIENT',
  PROFESSIONAL: 'PROFESSIONAL',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof userRole)[keyof typeof userRole];

export const UserRole: {
  readonly CLIENT: 'CLIENT';
  readonly PROFESSIONAL: 'PROFESSIONAL';
  readonly ADMIN: 'ADMIN';
} = userRole;

export const userRoles: readonly UserRole[] = [
  UserRole.CLIENT,
  UserRole.PROFESSIONAL,
  UserRole.ADMIN,
];

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.some((role) => role === value);
}
