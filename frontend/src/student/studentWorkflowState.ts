import type {
  BuildRunEntity,
  BuildRunStatus,
  DeliveryEntity,
  ProjectAssignmentEntity,
  StudentWorkflowState,
} from "../shared/types";

export interface StudentWorkflowPresentation {
  state: StudentWorkflowState;
  label: string;
  description: string;
  badgeClassName: string;
}

const RUNNING_STATUSES = new Set<BuildRunStatus>([
  "ANALYZING",
  "BUILDING",
  "DEPLOYING",
  "VALIDATING",
  "CLEANING",
]);

export function deriveStudentWorkflowState(input: {
  assignment?: ProjectAssignmentEntity | null;
  delivery?: DeliveryEntity | null;
  latestRun?: BuildRunEntity | null;
  now?: number;
}): StudentWorkflowState {
  const assignment = input.assignment ?? null;
  const delivery = input.delivery ?? null;
  const latestRun = input.latestRun ?? null;
  const now = input.now ?? Date.now();

  if (!assignment) {
    return "NOT_ASSIGNED";
  }

  if (assignment.opensAt && new Date(assignment.opensAt).getTime() > now) {
    return "WINDOW_NOT_OPEN";
  }

  if (delivery?.grade !== null && delivery?.grade !== undefined) {
    return "GRADED";
  }

  if (!delivery) {
    return "READY_TO_SUBMIT";
  }

  if (!latestRun) {
    return "RECEIVED";
  }

  if (latestRun.status === "QUEUED") {
    return "QUEUED";
  }

  if (RUNNING_STATUSES.has(latestRun.status)) {
    return "RUNNING";
  }

  if (delivery.status === "EVALUATED") {
    return "AWAITING_TEACHER_REVIEW";
  }

  if (delivery.status === "IN_REVIEW") {
    return latestRun.report ? "REPORT_READY" : "AWAITING_TEACHER_REVIEW";
  }

  return "RECEIVED";
}

export function describeStudentWorkflowState(
  state: StudentWorkflowState,
  options?: {
    isLate?: boolean;
    projectTitle?: string | null;
  },
): StudentWorkflowPresentation {
  const projectName = options?.projectTitle?.trim() || "tu proyecto";
  const lateSuffix = options?.isLate
    ? " La entrega quedó marcada fuera de plazo."
    : "";

  switch (state) {
    case "NOT_ASSIGNED":
      return {
        state,
        label: "Sin asignación",
        description:
          "Todavía no tienes una práctica asignada. Contacta con tu profesorado si esperabas verla aquí.",
        badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
      };
    case "WINDOW_NOT_OPEN":
      return {
        state,
        label: "Aún no abre",
        description:
          "La ventana de entrega todavía no está abierta. Podrás subir tu versión cuando llegue la fecha de apertura.",
        badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
      };
    case "READY_TO_SUBMIT":
      return {
        state,
        label: "Lista para entregar",
        description: `Ya puedes preparar y subir una versión para ${projectName}.`,
        badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
      };
    case "RECEIVED":
      return {
        state,
        label: "Entrega recibida",
        description:
          "La plataforma ya registró tu archivo y está esperando el siguiente paso operativo." +
          lateSuffix,
        badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
      };
    case "QUEUED":
      return {
        state,
        label: "En cola",
        description:
          "La evaluación automática está en cola. En cuanto arranque, verás el progreso del run." +
          lateSuffix,
        badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
      };
    case "RUNNING":
      return {
        state,
        label: "Ejecutándose",
        description:
          "El builder está analizando, construyendo o validando tu entrega ahora mismo." +
          lateSuffix,
        badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "REPORT_READY":
      return {
        state,
        label: "Informe disponible",
        description:
          "El informe técnico ya está listo para consulta. Revísalo antes de decidir si subes otra versión." +
          lateSuffix,
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "AWAITING_TEACHER_REVIEW":
      return {
        state,
        label: "Pendiente de revisión docente",
        description:
          "La evaluación automática terminó, pero todavía falta la revisión o la consolidación final del profesorado." +
          lateSuffix,
        badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
      };
    case "GRADED":
      return {
        state,
        label: "Calificada",
        description:
          "La entrega ya tiene nota oficial y observaciones consolidadas." +
          lateSuffix,
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
  }
}
