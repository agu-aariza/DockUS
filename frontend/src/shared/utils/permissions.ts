/**
 * @fileoverview Utilidad de apoyo de interfaz (permissions).
 *
 * @module permissions
 */

import type { SessionRecord } from "../session/session.types";
import type { UserRole } from "../types";

export function hasRole(
  session: SessionRecord | null,
  allowed: UserRole[],
): boolean {
  if (!session) return false;
  return allowed.includes(session.role);
}
