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

export interface OperationalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface ClientProfile {
  id: string;
  tenantId: string;
  userId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: OperationalUser;
}

export interface ProfessionalProfile {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: OperationalUser;
}

export interface ServiceItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  price: string;
  durationMinutes: number;
  points: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.some((role) => role === value);
}
