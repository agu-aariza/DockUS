/**
 * @fileoverview Servicio de aplicación compartido (group-roster-reader.port).
 *
 * @module group-roster-reader.port
 */

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
  /**
   * Grupos vigentes de un alumno (matrículas no revocadas). Es la vía por la que
   * `projects/` conoce la matrícula sin importar de `academic/`.
   */
  listGroupsForStudent(studentId: string): Promise<GroupSummary[]>;
}

export const GROUP_ROSTER_READER = Symbol('GROUP_ROSTER_READER');
