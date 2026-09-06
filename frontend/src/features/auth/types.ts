/**
 * @fileoverview Definiciones de tipos y componentes de características (types).
 *
 * @module types
 */

import type { SessionIdentity } from "../../shared/session/session.types";
import { UserRole } from "../../shared/types";

export type { SessionIdentity } from "../../shared/session/session.types";

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";

export interface AuthUser extends SessionIdentity {}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface UserEntity {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}
