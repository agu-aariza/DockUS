/**
 * @fileoverview Contratos de aplicación del dominio académico.
 *
 * @module academic.types
 */

export interface GroupEnrollmentResponse {
  id: string;
  groupId: string;
  studentId: string;
  studentEmail: string | null;
  studentName: string;
  enrolledById: string;
  enrolledAt: Date;
  revokedAt: Date | null;
}

export interface BulkEnrollResponse {
  enrollments: GroupEnrollmentResponse[];
  summary: {
    requestedIds: string[];
    requestedEmails: string[];
    requestedNames: string[];
    resolvedStudentIds: string[];
    enrolledCount: number;
    reactivatedCount: number;
    alreadyActiveCount: number;
    unresolvedEmails: string[];
    unresolvedNames: string[];
  };
}
