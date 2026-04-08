import type { BuildRunEntity, BuildRunEvent } from "../shared/types";

export function mergeEvents(
  current: BuildRunEvent[],
  incoming: BuildRunEvent[],
): BuildRunEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  incoming.forEach((event) => {
    byId.set(event.id, event);
  });
  return [...byId.values()].sort((left, right) => left.sequence - right.sequence);
}

export function formatDate(value?: string | null): string {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function summarizeRun(run: BuildRunEntity | null): string {
  if (!run) return "Sin run seleccionado.";
  const assessment = run.llmAssessment;
  return [
    run.runKind,
    run.status,
    assessment?.structuralType ? `tipo ${assessment.structuralType}` : null,
    assessment?.evaluativeState ? `estado ${assessment.evaluativeState}` : null,
    run.activeStage ? `etapa ${run.activeStage}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
