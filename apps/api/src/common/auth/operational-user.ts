import type { OperationalUser, UserRole } from '@ravion/types';

export const operationalUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
} as const;

export function toOperationalUser(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}): OperationalUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
}
