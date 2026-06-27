export interface GroupEnrollmentRosterEntry {
  studentId: string;
  studentEmail: string;
  studentName: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  code: string | null;
}

export interface GroupRosterReader {
  listEnrollments(groupId: string): Promise<GroupEnrollmentRosterEntry[]>;
  listGroups(): Promise<GroupSummary[]>;
}

export const GROUP_ROSTER_READER = Symbol('GROUP_ROSTER_READER');
