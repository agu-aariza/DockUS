import type { SessionRecord } from "../../features/auth/types";
import type { UserRole } from "../types";

export function hasRole(
  session: SessionRecord | null,
  allowed: UserRole[],
): boolean {
  if (!session) return false;
  return allowed.includes(session.role);
}
