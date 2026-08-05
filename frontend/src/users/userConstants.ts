/**
 * @fileoverview Constantes de dominio compartidas entre UsersPanel y sus modales
 * (roles, estados, etiquetas e iconografía por rol).
 *
 * @module userConstants
 */

import {
  RiShieldStarFill,
  RiBookOpenFill,
  RiGraduationCapFill,
} from 'react-icons/ri';
import type { UserStatus } from '../features/auth/types';
import type { UserRole } from '../shared/types';
import type { StatusTone } from '../shared/components/ui/StatusBadge';

export const USER_ROLES: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
export const USER_STATUSES: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  TEACHER: 'Docente',
  STUDENT: 'Estudiante',
};

export const STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: 'active',
  INACTIVE: 'idle',
  SUSPENDED: 'warning',
  PENDING_VERIFICATION: 'pending',
};

export const ROLE_TONE: Record<UserRole, StatusTone> = {
  ADMIN: 'danger',
  TEACHER: 'info',
  STUDENT: 'success',
};

export const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  ADMIN: RiShieldStarFill,
  TEACHER: RiBookOpenFill,
  STUDENT: RiGraduationCapFill,
};

// Mismo patrón bg-N-50/dark:bg-N-950 que el resto de la app (ver
// StudentDeliveriesSection, SubmissionStep3): las escalas numeradas no
// responden al tema, así que el dark: va explícito por tono.
export const AVATAR_TONE: Record<UserRole, string> = {
  ADMIN: 'bg-danger-50 text-danger-700 dark:bg-danger-950 dark:text-danger-400',
  TEACHER: 'bg-primary-subtle text-primary',
  STUDENT: 'bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-400',
};
