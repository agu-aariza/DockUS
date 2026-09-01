/**
 * Tipos transversales para la identidad autenticada y las sesiones persistidas.
 *
 * Este módulo no depende de `features/auth`, de modo que la infraestructura de
 * sesión puede consumirse desde cualquier dominio sin invertir la dirección de
 * dependencias.
 */

import type { UserRole } from "../types";

export interface SessionIdentity {
  id: string;
  email: string;
  role: UserRole;
}

export interface SessionAuthPayload {
  user: SessionIdentity;
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
