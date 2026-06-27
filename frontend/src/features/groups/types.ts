export interface CourseGroupEntity {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  studentCount: number;
}

export interface GroupEnrollmentEntity {
  id: string;
  groupId: string;
  groupName: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  enrolledById: string;
  enrolledAt: string;
  revokedAt: string | null;
}

export interface BulkGroupEnrollResponse {
  enrollments: GroupEnrollmentEntity[];
  summary: {
    requestedIds: string[];
    requestedEmails: string[];
    resolvedStudentIds: string[];
    enrolledCount: number;
    reactivatedCount: number;
    alreadyActiveCount: number;
    unresolvedEmails: string[];
    unresolvedNames: string[];
  };
}
