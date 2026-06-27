import { RiLoader4Line, RiSignalWifiErrorLine, RiTimeLine } from "react-icons/ri";

import { Button } from "../../shared/components/ui/Button";
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

  return (
    <section
      className="rounded-xl border border-primary/20 bg-primary/5 p-6"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-primary/70">
            Evaluacion en vivo
          </p>
          <h3 className="mt-2 text-xl font-semibold text-primary">
            {isActive
              ? `Fase actual: ${progress.label}`
              : run.status === "SUCCESS"
                ? "La evaluacion ya termino"
                : "La evaluacion ya no esta activa"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-primary/80">
            El stream reutiliza el timeline real del builder y cae a polling si la
            conexion SSE no se puede mantener.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold uppercase text-primary">
            {streamState === "streaming"
              ? "SSE activo"
              : streamState === "polling"
                ? "Fallback a polling"
                : "Conectando"}
          </span>
          {onOpenReport ? (
            <Button variant="secondary" onClick={onOpenReport}>
              Abrir informe
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-3 rounded-full bg-primary transition-all duration-300"
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
                  ? "border-primary bg-white text-primary"
                  : reached
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-white/70 bg-white/70 text-slate-400"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                {isCurrent ? <RiLoader4Line className="animate-spin" /> : null}
                {step.label}
              </div>
              <div className="mt-2 text-sm font-medium">
                {isCurrent ? "En curso" : reached ? "Completado" : "Pendiente"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-white/70 bg-white/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary/70">
            <RiTimeLine />
            Tiempo transcurrido
          </div>
          <div className="mt-2 text-lg font-semibold text-primary">
            {formatDuration(elapsedMs)}
          </div>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/70 p-4">
          <div className="text-xs font-semibold uppercase text-primary/70">
            Referencia personal
          </div>
          <div className="mt-2 text-lg font-semibold text-primary">
            {historicalMedianMs ? formatDuration(historicalMedianMs) : "Sin historial"}
          </div>
          <p className="mt-1 text-xs leading-5 text-primary/70">
            Mediana de tus ultimas evaluaciones completas.
          </p>
        </div>
        <div className="rounded-lg border border-white/70 bg-white/70 p-4">
          <div className="text-xs font-semibold uppercase text-primary/70">
            Estado tecnico
          </div>
          <div className="mt-2 text-lg font-semibold text-primary">
            {run.status}
          </div>
          <p className="mt-1 text-xs leading-5 text-primary/70">
            {streamError
              ? "Estamos manteniendo la sincronizacion con un modo degradado."
              : "La superficie esta leyendo el mismo timeline que consume el panel docente."}
          </p>
        </div>
      </div>

      {streamError ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <RiSignalWifiErrorLine className="mt-0.5 shrink-0 text-base" />
          <div>
            <div className="font-semibold">Conexion en modo degradado</div>
            <p className="mt-1 leading-6">{streamError}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
