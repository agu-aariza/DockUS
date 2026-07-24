/**
 * @fileoverview Definiciones de tipos y componentes de características (types).
 *
 * @module types
 */

import { UserRole } from "../../shared/types";

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface SessionRecord {
  id: string;
  label: string;
  userId: string;
  email: string;
  role: UserRole;
  accessToken: string;
  refreshToken: string;
  createdAt: string;
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
