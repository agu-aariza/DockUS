import type { BuildRunEntity, BuildRunEvent } from "../shared/types";

export type StudentRunStage =
  | "queued"
  | "building"
  | "executing"
  | "evaluating"
  | "analyzing"
  | "completed"
  | "failed";

export interface StudentRunProgressSnapshot {
  stage: StudentRunStage;
  progress: number;
  label: string;
}

const STAGE_ORDER: StudentRunStage[] = [
  "building",
  "executing",
  "evaluating",
  "analyzing",
];

const STAGE_LABELS: Record<StudentRunStage, string> = {
  queued: "En cola",
  building: "Construir",
  executing: "Ejecutar",
  evaluating: "Evaluar",
  analyzing: "Analizar",
  completed: "Completado",
  failed: "Fallido",
};

const STAGE_PROGRESS: Record<StudentRunStage, number> = {
  queued: 0.05,
  building: 0.2,
  executing: 0.5,
  evaluating: 0.72,
  analyzing: 0.9,
  completed: 1,
  failed: 1,
};

function readStudentStage(
  event: BuildRunEvent,
): StudentRunStage | null {
  const studentStage = event.payload?.studentStage;
  if (typeof studentStage === "string") {
    switch (studentStage) {
      case "queued":
      case "building":
      case "executing":
      case "evaluating":
      case "analyzing":
      case "completed":
      case "failed":
        return studentStage;
    }
  }

  if (event.eventType === "RUN_COMPLETED") {
    return "completed";
  }
  if (event.eventType === "RUN_FAILED" || event.eventType === "RUN_CANCELLED") {
    return "failed";
  }

  const message = event.message.toLowerCase();
  if (message.includes("analizando arquitectura") || message.includes("preparacion")) {
    return "building";
  }
  if (
    message.includes("orquestacion") ||
    message.includes("servicio") ||
    message.includes("stdout") ||
    message.includes("stderr")
  ) {
    return "executing";
  }
  if (message.includes("auditoria final") || message.includes("evaluador")) {
    return "evaluating";
  }
  if (message.includes("calidad") || message.includes("seguridad")) {
    return "analyzing";
  }

  return null;
}

export function deriveStudentRunProgress(
  events: BuildRunEvent[],
  run: BuildRunEntity | null | undefined,
): StudentRunProgressSnapshot {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const stage = readStudentStage(events[index]);
    if (stage) {
      return {
        stage,
        progress: STAGE_PROGRESS[stage],
        label: STAGE_LABELS[stage],
      };
    }
  }

  if (run?.status === "FAILED" || run?.status === "CANCELLED") {
    return {
      stage: "failed",
      progress: STAGE_PROGRESS.failed,
      label: STAGE_LABELS.failed,
    };
  }
  if (run?.status === "SUCCESS") {
    return {
      stage: "completed",
      progress: STAGE_PROGRESS.completed,
      label: STAGE_LABELS.completed,
    };
  }
  if (run?.status === "RUNNING") {
    return {
      stage: "executing",
      progress: STAGE_PROGRESS.executing,
      label: STAGE_LABELS.executing,
    };
  }

  return {
    stage: "queued",
    progress: STAGE_PROGRESS.queued,
    label: STAGE_LABELS.queued,
  };
}

export function isStageReached(
  currentStage: StudentRunStage,
  stage: Extract<StudentRunStage, "building" | "executing" | "evaluating" | "analyzing">,
): boolean {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const stageIndex = STAGE_ORDER.indexOf(stage);

  if (currentStage === "completed") {
    return true;
  }
  if (currentStage === "failed") {
    return stageIndex <= Math.max(currentIndex, 0);
  }

  return currentIndex >= stageIndex;
}
