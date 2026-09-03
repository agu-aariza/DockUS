/**
 * @fileoverview Panel y vista del espacio del alumno (SubmissionCoachingPreview).
 *
 * @module SubmissionCoachingPreview
 */

import type { BuildRunEntity } from "../features/builder/types";

interface SubmissionCoachingPreviewProps {
  run: BuildRunEntity;
  remainingDeliveries: number;
}

export function SubmissionCoachingPreview({
  run,
  remainingDeliveries,
}: SubmissionCoachingPreviewProps): JSX.Element | null {
  const summary = run.reportSummary;
  if (!summary.hasReport) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-app-border bg-app-surface p-4 text-sm text-app-text-secondary">
        {summary.passReadiness === "BLOCKED"
          ? "El informe detecta bloqueos. Ábrelo para ver la evidencia y las acciones prioritarias."
          : "El informe está listo y contiene mejoras opcionales para la siguiente versión."}
      </div>
      {remainingDeliveries <= 0 ? (
        <div className="rounded-lg border border-app-border bg-app-bg-subtle px-4 py-3 text-sm text-app-text-secondary">
          Ya no quedan intentos para reenviar esta practica, pero puedes usar
          este resumen para entender que habria que corregir.
        </div>
      ) : null}
    </div>
  );
}
