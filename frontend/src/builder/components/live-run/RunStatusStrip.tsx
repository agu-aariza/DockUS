/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (RunStatusStrip).
 *
 * @module RunStatusStrip
 */

import type { BuildRunEntity } from "../../../features/builder/types";
import { cn, confidenceLabel, gradeTone, GRADE_TEXT_CLASS } from "./liveRunUtils";

interface RunStatusStripProps {
  selectedRun: BuildRunEntity;
}

const STATUS_DOT: Record<string, string> = {
  SUCCESS: "bg-success",
  FAILED: "bg-danger",
};

/**
 * Lectura del run en una sola superficie: estado, infraestructura y evaluación.
 * Mismo instrumento que el panel del profesor, para que la app se lea como una sola cosa.
 */
export function RunStatusStrip({ selectedRun }: RunStatusStripProps): JSX.Element {
  const assessment = selectedRun.llmAssessment;
  const grade = assessment?.recommendedGrade;
  const isTerminal = selectedRun.status === "SUCCESS" || selectedRun.status === "FAILED";

  return (
    <section
      aria-label="Estado del run"
      className="mb-6 grid gap-px overflow-hidden rounded-lg border border-app-border bg-app-border md:grid-cols-2"
    >
      <div className="bg-white px-5 py-4">
        <div className="ui-label">Ejecución</div>
        <div className="mt-2 flex items-center gap-2.5">
          <span
            className={cn(
              "h-2.5 w-2.5 shrink-0 rounded-full",
              STATUS_DOT[selectedRun.status] ?? "bg-primary status-pulse status-pulse-primary",
            )}
            aria-hidden="true"
          />
          <span className="data-figure text-xl font-semibold">{selectedRun.status}</span>
        </div>
      </div>

      <div className="bg-white px-5 py-4">
        <div className="ui-label">Evaluación</div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <div>
            <span className="data-figure text-xl font-semibold">
              {assessment?.evaluativeState ?? "—"}
            </span>
            <span className="ml-2 text-sm text-slate-500">
              confianza {confidenceLabel(assessment?.confidence)}
            </span>
          </div>

          {grade !== undefined && (
            <div className="text-right">
              <div className={cn("data-figure text-3xl font-semibold", GRADE_TEXT_CLASS[gradeTone(grade)])}>
                {grade.toFixed(2)}
              </div>
              <div className="ui-label mt-0.5">{grade >= 5 ? "Aprobado" : "Suspenso"}</div>
            </div>
          )}
        </div>
        {grade === undefined && (
          <p className="mt-2 text-sm text-slate-500">
            {isTerminal ? "El run terminó sin nota." : "A la espera del evaluador."}
          </p>
        )}
      </div>
    </section>
  );
}
