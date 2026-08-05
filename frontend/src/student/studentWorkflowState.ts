/**
 * @fileoverview Panel y vista del espacio del alumno (studentWorkflowState).
 *
 * @module studentWorkflowState
 */

import type {
  BuildRunEntity,
  BuildRunStatus,
  DeliveryEntity,
  ProjectAssignmentEntity,
  StudentWorkflowState,
} from "../shared/types";
import type { StatusTone } from "../shared/components/ui/StatusBadge";

interface StudentWorkflowPresentation {
  state: StudentWorkflowState;
  label: string;
  description: string;
  /**
   * Tono del `StatusBadge` compartido, no una clase suelta: la paleta real
   * de la app tiene tres colores de estado (success/warning/danger) más el
   * granate institucional — un tono por cada uno de los diez estados del
   * pipeline (sky/violet/fuchsia/indigo/rose...) es justo el arcoíris sin
   * sistema que hace que un dashboard se lea genérico.
   */
  tone: StatusTone;
}

const RUNNING_STATUSES = new Set<BuildRunStatus>(["RUNNING"]);

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

  if (latestRun.status === "FAILED" && !Boolean(latestRun.report)) {
    return "BUILD_FAILED";
  }

  const hasReadableTechnicalClosure = Boolean(latestRun.report);

  if (hasReadableTechnicalClosure) {
    return "REPORT_READY";
  }

  if (delivery.status === "EVALUATED" || delivery.status === "IN_REVIEW") {
    return "AWAITING_TEACHER_REVIEW";
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
        tone: "idle",
      };
    case "WINDOW_NOT_OPEN":
      return {
        state,
        label: "Aún no abre",
        description:
          "La ventana de entrega todavía no está abierta. Podrás subir tu versión cuando llegue la fecha de apertura.",
        tone: "idle",
      };
    case "READY_TO_SUBMIT":
      return {
        state,
        label: "Lista para entregar",
        description: `Ya puedes preparar y subir una versión para ${projectName}.`,
        tone: "info",
      };
    case "RECEIVED":
      return {
        state,
        label: "Entrega recibida",
        description:
          "La plataforma ya registró tu archivo y está esperando el siguiente paso operativo." +
          lateSuffix,
        tone: "idle",
      };
    case "QUEUED":
      return {
        state,
        label: "En cola",
        description:
          "La evaluación automática está en cola. En cuanto arranque, verás el progreso del run." +
          lateSuffix,
        tone: "running",
      };
    case "RUNNING":
      return {
        state,
        label: "Ejecutándose",
        description:
          "El builder está analizando, construyendo o validando tu entrega ahora mismo." +
          lateSuffix,
        tone: "running",
      };
    case "BUILD_FAILED":
      return {
        state,
        label: "Error de construcción",
        description:
          "El proceso automático falló antes de generar un informe. Revisa tu código y vuelve a intentarlo." +
          lateSuffix,
        tone: "danger",
      };
    case "REPORT_READY":
      return {
        state,
        label: "Informe disponible",
        description:
          "El informe técnico ya está listo para consulta. Revísalo antes de decidir si subes otra versión." +
          lateSuffix,
        tone: "success",
      };
    case "AWAITING_TEACHER_REVIEW":
      return {
        state,
        label: "Pendiente de revisión docente",
        description:
          "La evaluación automática terminó, pero todavía falta la revisión o la consolidación final del profesorado." +
          lateSuffix,
        tone: "pending",
      };
    case "GRADED":
      return {
        state,
        label: "Calificada",
        description:
          "La entrega ya tiene nota oficial y observaciones consolidadas." +
          lateSuffix,
        tone: "success",
      };
  }
}
