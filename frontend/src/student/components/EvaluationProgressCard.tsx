import {
  RiLoader4Line,
  RiSignalWifiErrorLine,
  RiTimeLine,
} from "react-icons/ri";

import { Button } from "../../shared/components/ui/Button";
import { Alert } from "../../shared/components/ui/Alert";
import type { BuildRunEntity, SessionRecord } from "../../shared/types";
import { useBuildRunStream } from "../hooks/useBuildRunStream";
import { isStageReached } from "../studentBuildRunStages";

interface EvaluationProgressCardProps {
  run: BuildRunEntity;
  session: SessionRecord | null;
  historicalMedianMs?: number | null;
  onOpenReport?: () => void;
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function EvaluationProgressCard({
  run,
  session,
  historicalMedianMs,
  onOpenReport,
}: EvaluationProgressCardProps): JSX.Element {
  const { progress, streamState, streamError, elapsedMs, isActive } =
    useBuildRunStream(run, session);

  const steps = [
    { key: "building", label: "Construir" },
    { key: "executing", label: "Ejecutar" },
    { key: "evaluating", label: "Evaluar" },
    { key: "analyzing", label: "Analizar" },
  ] as const;

  const streamLabel =
    streamState === "streaming"
      ? "SSE activo"
      : streamState === "polling"
        ? "Fallback a polling"
        : "Conectando";

  return (
    <section
      className="rounded-lg border border-app-border bg-white p-5"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Evaluación en vivo
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            {isActive
              ? `Fase actual: ${progress.label}`
              : run.status === "SUCCESS"
                ? "La evaluación ya terminó"
                : "La evaluación ya no está activa"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            El stream reutiliza el timeline real del builder y cae a polling si la
            conexión SSE no se puede mantener.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-app-border bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            {streamLabel}
          </span>
          {onOpenReport ? (
            <Button variant="secondary" onClick={onOpenReport}>
              Abrir informe
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.round(progress.progress * 100)}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        {steps.map((step) => {
          const reached = isStageReached(progress.stage, step.key);
          const isCurrent = progress.stage === step.key;

          return (
            <div
              key={step.key}
              className={`rounded-lg border px-4 py-4 ${
                isCurrent
                  ? "border-primary bg-white"
                  : reached
                    ? "border-app-border bg-slate-50"
                    : "border-app-border bg-white"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                {isCurrent ? (
                  <RiLoader4Line className="animate-spin text-primary" />
                ) : reached ? (
                  <span className="h-2 w-2 rounded-full bg-success" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                )}
                {step.label}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {isCurrent ? "En curso" : reached ? "Completado" : "Pendiente"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-app-border bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
            <RiTimeLine />
            Tiempo transcurrido
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {formatDuration(elapsedMs)}
          </div>
        </div>
        <div className="rounded-lg border border-app-border bg-white p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Referencia personal
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {historicalMedianMs ? formatDuration(historicalMedianMs) : "Sin historial"}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Mediana de tus últimas evaluaciones completas.
          </p>
        </div>
        <div className="rounded-lg border border-app-border bg-white p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Estado técnico
          </div>
          <div className="mt-2 text-lg font-semibold text-slate-900">
            {run.status}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {streamError
              ? "Estamos manteniendo la sincronización con un modo degradado."
              : "La superficie está leyendo el mismo timeline que consume el panel docente."}
          </p>
        </div>
      </div>

      {streamError ? (
        <Alert
          variant="warning"
          title="Conexión en modo degradado"
          icon={<RiSignalWifiErrorLine />}
          className="mt-6"
        >
          {streamError}
        </Alert>
      ) : null}
    </section>
  );
}
