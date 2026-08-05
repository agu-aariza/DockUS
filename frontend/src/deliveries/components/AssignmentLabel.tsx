/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (AssignmentLabel).
 *
 * @module AssignmentLabel
 */

import { ProjectAssignmentEntity } from "../../shared/types";

export function AssignmentLabel({ assignment }: { assignment: ProjectAssignmentEntity | undefined }) {
  if (!assignment) {
    return <>Todos los alumnos</>;
  }

  return (
    <>
      <span className="font-semibold text-app-text">{assignment.studentName}</span>
      <span className="mx-2 text-app-text-muted/50">|</span>
      <span className="text-app-text-secondary">{assignment.projectTitle}</span>
    </>
  );
}
