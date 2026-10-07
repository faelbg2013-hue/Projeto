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

export interface AdminClientMovement {
  type: PointsTransactionType;
  points: number;
  reason: string;
  createdAt: string;
}

export interface AdminClientAppointment {
  date: string;
  time: string;
  professionalName: string;
  serviceName: string;
  status: AppointmentStatus;
  bookingMode: BookingMode;
}

export interface AdminClientAppointmentSummary {
  total: number;
  upcoming: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

/** Visão administrativa de um cliente. O saldo sai do ledger e não é um campo persistido. */
export interface AdminClientDetail {
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  points: {
    balance: number;
    recent: AdminClientMovement[];
  };
  appointments: {
    summary: AdminClientAppointmentSummary;
    upcoming: AdminClientAppointment[];
    history: AdminClientAppointment[];
  };
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

export interface AdminProfessionalService {
  name: string;
  durationMinutes: number;
  isActive: boolean;
  price: string;
}

export interface AdminProfessionalInterval {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface AdminProfessionalAppointment {
  date: string;
  time: string;
  clientName: string;
  serviceName: string;
  status: AppointmentStatus;
  bookingMode: BookingMode;
}

export interface AdminProfessionalAppointmentSummary {
  total: number;
  today: number;
  upcoming: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

/** Visão administrativa de um profissional. Serviços são o catálogo do tenant, sem vínculo individual. */
export interface AdminProfessionalDetail {
  displayName: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  services: AdminProfessionalService[];
  week: AdminProfessionalInterval[];
  appointments: {
    summary: AdminProfessionalAppointmentSummary;
    upcoming: AdminProfessionalAppointment[];
    history: AdminProfessionalAppointment[];
  };
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
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  noShow: number;
  servicesValue: string;
  pointsRedeemed: number;
  pointsReversed: number;
  pointsEarned: number;
}

/** Contagens do estabelecimento. Não dependem do dia nem do profissional filtrado. */
export interface DashboardTotals {
  /** Todos os clientes do tenant, ativos e inativos. */
  clients: number;
  activeProfessionals: number;
  activeServices: number;
}

export interface DashboardAppointment {
  id: string;
  /** Dia civil do início, em America/Sao_Paulo. */
  date: string;
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
  totals: DashboardTotals;
  /** Até cinco inícios futuros em PENDING ou CONFIRMED, do mais próximo ao mais distante. */
  upcoming: DashboardAppointment[];
  appointments: DashboardAppointment[];
  professionals: DashboardProfessional[];
}

export interface ProfessionalDaySummary {
  total: number;
  confirmed: number;
  completed: number;
  noShow: number;
  cancelled: number;
}

export interface ProfessionalDayAppointment {
  id: string;
  startAt: string;
  endAt: string;
  time: string;
  endTime: string;
  clientName: string;
  serviceName: string;
  serviceDescription: string | null;
  durationMinutes: number;
  price: string;
  status: AppointmentStatus;
  bookingMode: BookingMode;
  redemptionPointsSnapshot: number | null;
  pointsSnapshot: number;
}

export interface BusinessHoursDay {
  enabled: boolean;
  open: string | null;
  close: string | null;
}

/** Horário do estabelecimento. Quando salvo, limita a disponibilidade do profissional. */
export interface BusinessHours {
  monday: BusinessHoursDay;
  tuesday: BusinessHoursDay;
  wednesday: BusinessHoursDay;
  thursday: BusinessHoursDay;
  friday: BusinessHoursDay;
  saturday: BusinessHoursDay;
  sunday: BusinessHoursDay;
}

/** Chaves de preferência publicadas pela API. */
export interface TenantSettingValues {
  business_hours?: BusinessHours;
  /** Minutos. Ausente no banco vale 0 e não restringe o agendamento. */
  booking_min_advance_minutes?: number;
  /** Minutos. Ausente no banco vale 0 e não restringe o cancelamento do cliente. */
  cancellation_min_advance_minutes?: number;
  /** Minutos depois de cada atendimento antes do próximo. Ausente no banco vale 0. */
  appointment_buffer_minutes?: number;
  /** Dias de calendário em America/Sao_Paulo. Ausente no banco vale 0 e não limita a data. */
  booking_max_advance_days?: number;
}

export interface TenantSettingsResponse {
  settings: TenantSettingValues;
}

export interface UpdateTenantSettings {
  settings?: TenantSettingValues;
}

export interface ProfessionalDay {
  date: string;
  summary: ProfessionalDaySummary;
  nextAppointment: ProfessionalDayAppointment | null;
  currentAppointment: ProfessionalDayAppointment | null;
  appointments: ProfessionalDayAppointment[];
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && userRoles.some((role) => role === value);
}
