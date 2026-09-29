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
  redemptionPoints: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInterval {
  id: string;
  tenantId: string;
  professionalId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalSchedule {
  professionalId: string;
  intervals: ScheduleInterval[];
}

export interface TimeBlock {
  id: string;
  tenantId: string;
  professionalId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleExceptionType = 'BLOCK' | 'OPEN';

export interface ScheduleException {
  id: string;
  tenantId: string;
  professionalId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  type: ScheduleExceptionType;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  date: string;
  professionalId: string;
  serviceId: string;
  durationMinutes: number;
  slots: string[];
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type BookingMode = 'NORMAL' | 'POINTS';

export interface AppointmentItem {
  id: string;
  tenantId: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  price: string;
  durationMinutes: number;
  pointsSnapshot: number;
  bookingMode: BookingMode;
  redemptionPointsSnapshot: number | null;
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
}

export interface BookableProfessional {
  id: string;
  displayName: string;
}

export type PointsTransactionType =
  | 'EARN'
  | 'REDEEM'
  | 'REDEEM_REVERSAL'
  | 'ADJUSTMENT_CREDIT'
  | 'ADJUSTMENT_DEBIT';

export interface PointsBalance {
  balance: number;
}

export interface PointsTransactionItem {
  id: string;
  type: PointsTransactionType;
  points: number;
  reason: string;
  appointmentId: string | null;
  serviceName: string | null;
  createdAt: string;
}

export interface ClientPointsSummary {
  clientId: string;
  balance: number;
  credits: number;
  debits: number;
  lastTransaction: PointsTransactionItem | null;
}

export interface PointsAdjustmentResult {
  balance: number;
  transaction: PointsTransactionItem;
}

export interface DashboardSummary {
  totalAppointments: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  servicesValue: string;
  pointsRedeemed: number;
  pointsReversed: number;
  pointsEarned: number;
}

export interface DashboardAppointment {
  id: string;
  time: string;
  clientName: string;
  professionalName: string;
  serviceName: string;
  durationMinutes: number;
  price: string;
  status: AppointmentStatus;
  bookingMode: BookingMode;
  redemptionPointsSnapshot: number | null;
}

export interface DashboardProfessional {
  professionalId: string;
  name: string;
  appointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  servicesValue: string;
}

export interface OperationalDashboard {
  date: string;
  summary: DashboardSummary;
  upcoming: DashboardAppointment[];
  appointments: DashboardAppointment[];
  professionals: DashboardProfessional[];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.some((role) => role === value);
}
