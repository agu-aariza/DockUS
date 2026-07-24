/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (EvaluationProgressCard).
 *
 * @module EvaluationProgressCard
 */

import {
  RiLoader4Line,
  RiSignalWifiErrorLine,
  RiTimeLine,
  RiTerminalBoxLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
} from "react-icons/ri";
import { useState, useEffect, useMemo } from "react";

import { Button } from "../../shared/components/ui/Button";
import { Alert } from "../../shared/components/ui/Alert";
import type { BuildRunEntity } from "../../shared/types";
import { useSession } from "../../shared/session/SessionContext";
import { useBuildRunStream } from "../hooks/useBuildRunStream";
import { isStageReached } from "../studentBuildRunStages";
import { TerminalViewer } from "../../shared/components/TerminalViewer";

interface EvaluationProgressCardProps {
  run: BuildRunEntity;
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
  historicalMedianMs,
  onOpenReport,
}: EvaluationProgressCardProps): JSX.Element {
  const { activeSession } = useSession();
  const { progress, streamState, streamError, elapsedMs, isActive, events } =
    useBuildRunStream(run, activeSession);

  const [showLogs, setShowLogs] = useState(false);

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

  const logs = useMemo(() => {
    return events
      .filter((event) => event.eventType === "LOG_CHUNK")
      .map((event) =>
        typeof event.payload?.text === "string" ? event.payload.text : ""
      )
      .filter(Boolean)
      .join("");
  }, [events]);

  useEffect(() => {
    if (run.status === "FAILED") {
      setShowLogs(true);
    }
  }, [run.status]);

  const progressPercent = Math.round(progress.progress * 100);

  return (
    <section
      className="rounded-lg border border-app-border bg-white p-5 shadow-sm"
      aria-live="polite"
      aria-busy={isActive}
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
          <span className="inline-flex items-center gap-2 rounded-full border border-app-border bg-slate-50 px-3 py-1 text-xs font-semibold uppercase text-slate-600">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                streamState === "streaming"
                  ? "bg-success status-pulse status-pulse-success"
                  : streamState === "polling"
                    ? "bg-warning"
                    : "bg-slate-400"
              }`}
              aria-hidden="true"
            />
            {streamLabel}
          </span>
          {onOpenReport ? (
            <Button variant="secondary" onClick={onOpenReport}>
              Abrir informe
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className="mt-6 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de la evaluación"
      >
        <div
          className="h-2 rounded-full bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        {steps.map((step) => {
          const reached = isStageReached(progress.stage, step.key);
          const isCurrent = progress.stage === step.key;

          return (
            <div
              key={step.key}
              className={`rounded-lg border px-4 py-4 transition-colors duration-300 motion-reduce:transition-none ${
                isCurrent
                  ? "border-primary bg-primary-subtle status-pulse status-pulse-primary"
                  : reached
                    ? "border-success/30 bg-success-subtle"
                    : "border-app-border bg-white"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
                {isCurrent ? (
                  <RiLoader4Line
                    className="animate-spin text-primary motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : reached ? (
                  <span
                    className="h-2 w-2 rounded-full bg-success"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="h-2 w-2 rounded-full bg-slate-300"
                    aria-hidden="true"
                  />
                )}
                {step.label}
              </div>
              <div
                className={`mt-2 text-sm font-medium ${
                  isCurrent ? "text-primary" : "text-slate-900"
                }`}
              >
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

      {logs ? (
        <div className="mt-6 border-t border-app-border pt-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-950 transition-colors focus-visible:outline-none"
              aria-expanded={showLogs}
            >
              <RiTerminalBoxLine className="text-base" />
              <span>Consola de logs ({showLogs ? "ocultar" : "mostrar"})</span>
              {showLogs ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
            </button>
            {run.status === "FAILED" && (
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                La ejecución falló: revisa los logs
              </span>
            )}
          </div>

          {showLogs && (
            <div className="animate-in fade-in slide-in-from-top-1 duration-150">
              <TerminalViewer
                content={logs}
                title="Consola de compilación y sandbox"
                maxHeight="300px"
              />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
