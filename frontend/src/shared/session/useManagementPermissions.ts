import type { SessionRecord, UserRole } from "../types";
import { hasRole } from "../utils/permissions";

export function useManagementPermissions(session: SessionRecord | null) {
  const canRead = Boolean(session);
  const canWrite = hasRole(session, ["ADMIN", "TEACHER"]);
  const canAdmin = hasRole(session, ["ADMIN"]);

  return {
    canRead,
    canWrite,
    canAdmin,
    canUpload: canRead,
    canTeacherOrAdmin: canWrite,
    hasAnyRole: (roles: UserRole[]) => hasRole(session, roles),
  };
}
