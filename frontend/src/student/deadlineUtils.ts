import type { ProjectAssignmentEntity } from "../shared/types";

type AssignmentTimelineState =
  | "upcoming"
  | "open"
  | "open-no-deadline"
  | "late";

interface AssignmentTimelineSummary {
  state: AssignmentTimelineState;
  headline: string;
  countdownLabel: string | null;
  detail: string;
}

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatAssignmentDate(value?: string | null): string {
  if (!value) {
    return "Sin fecha";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return dateFormatter.format(parsed);
}

function formatDuration(milliseconds: number): string {
  const absoluteMs = Math.abs(milliseconds);
  const totalMinutes = Math.max(1, Math.floor(absoluteMs / 60000));
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays >= 2) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0
      ? `${totalDays} d ${remainingHours} h`
      : `${totalDays} d`;
  }

  if (totalHours >= 1) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0
      ? `${totalHours} h ${remainingMinutes} min`
      : `${totalHours} h`;
  }

  return `${totalMinutes} min`;
}

export function describeAssignmentTimeline(
  assignment: ProjectAssignmentEntity,
  now = Date.now(),
): AssignmentTimelineSummary {
  const opensAt = assignment.opensAt ? new Date(assignment.opensAt).getTime() : null;
  const closesAt = assignment.closesAt ? new Date(assignment.closesAt).getTime() : null;

  if (opensAt && opensAt > now) {
    return {
      state: "upcoming",
      headline: "Entrega aún no abierta",
      countdownLabel: `Abre en ${formatDuration(opensAt - now)}`,
      detail: `La ventana empieza el ${formatAssignmentDate(assignment.opensAt)}.`,
    };
  }

  if (closesAt && closesAt < now) {
    return {
      state: "late",
      headline: "Plazo vencido",
      countdownLabel: `Venció hace ${formatDuration(now - closesAt)}`,
      detail: `La fecha límite fue el ${formatAssignmentDate(assignment.closesAt)}. Aun puedes entregar con marca de retraso.`,
    };
  }

  if (closesAt) {
    return {
      state: "open",
      headline: "Entrega abierta",
      countdownLabel: `Cierra en ${formatDuration(closesAt - now)}`,
      detail: `La fecha límite es el ${formatAssignmentDate(assignment.closesAt)}.`,
    };
  }

  return {
    state: "open-no-deadline",
    headline: "Entrega abierta",
    countdownLabel: null,
    detail: "Este proyecto no tiene fecha de cierre definida todavía.",
  };
}

export function pickPrimaryAssignment(
  assignments: ProjectAssignmentEntity[],
  selectedAssignmentId?: string | null,
  selectedProjectId?: string | null,
): ProjectAssignmentEntity | null {
  if (selectedAssignmentId) {
    const selectedAssignment = assignments.find(
      (assignment) => assignment.id === selectedAssignmentId,
    );
    if (selectedAssignment) {
      return selectedAssignment;
    }
  }

  if (selectedProjectId) {
    const selectedProject = assignments.find(
      (assignment) => assignment.projectId === selectedProjectId,
    );
    if (selectedProject) {
      return selectedProject;
    }
  }

  const datedAssignments = [...assignments].sort((left, right) => {
    const leftTime =
      left.closesAt ?? left.opensAt ?? left.assignedAt;
    const rightTime =
      right.closesAt ?? right.opensAt ?? right.assignedAt;

    return new Date(leftTime).getTime() - new Date(rightTime).getTime();
  });

  return datedAssignments[0] ?? assignments[0];
}
