import { ProjectAssignmentEntity } from "../../shared/types";

export function AssignmentLabel({ assignment }: { assignment: ProjectAssignmentEntity | undefined }) {
  if (!assignment) {
    return <>Sin asignación</>;
  }

  return (
    <>
      <span className="font-semibold text-slate-900">{assignment.studentName}</span>
      <span className="mx-2 text-slate-300">|</span>
      <span className="text-slate-500">{assignment.projectTitle}</span>
    </>
  );
}
