/**
 * @fileoverview Panel de estado del runtime y Docker daemon (RuntimeStatusBar).
 *
 * @module RuntimeStatusBar
 */

import { useQuery } from "@tanstack/react-query";
import { healthApi } from "../../health/api/healthApi";
import { queryKeys } from "../../shared/query/queryKeys";
import {
  DEPENDENCY_LABEL,
  type ReadinessDependency,
} from "../../features/health/types";
import type { StreamState } from "../../builder/hooks/useBuilderRunStream";

const DEPENDENCIES: ReadinessDependency[] = ["database", "redis", "docker", "bedrock"];

/** Cada cuánto se vuelve a sondear la salud. Suficiente para enterarse, sin martillear la API. */
const POLL_INTERVAL_MS = 30_000;

interface RuntimeStatusBarProps {
  runCount: number;
  streamState: StreamState;
  latestSequence: number;
}

/**
 * Barra de estado del runtime: solo lo que es cierto y cambia.
 *
 * Sustituye a una fila de tarjetas donde dos de las cuatro cifras estaban hardcodeadas
 * ("OPERATIVA", "LLM + Builder"): decían lo mismo con la plataforma sana que con Postgres
 * caído. Aquí la salud sale del endpoint /health/readiness, que sondea de verdad.
 */
export function RuntimeStatusBar({
  runCount,
  streamState,
  latestSequence,
}: RuntimeStatusBarProps): JSX.Element {
  // El default de v5 refetchIntervalInBackground:false pausa el sondeo con la
  // pestaña oculta (antes sondeaba igual en segundo plano) — mejora, no
  // regresión, sin efecto visible porque esta barra no se renderiza si la
  // pestaña no tiene foco.
  const readinessQuery = useQuery({
    queryKey: queryKeys.health.readiness(),
    queryFn: ({ signal }) => healthApi.readiness(signal),
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  });
  const report = readinessQuery.data ?? null;
  const unreachable = readinessQuery.isError;

  const healthy = report?.status === "ok";
  const streaming = streamState === "streaming";

  return (
    <section
      aria-label="Estado del runtime"
      className="flex flex-col gap-3 rounded-lg border border-app-border bg-app-surface px-5 py-3 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Signal
          tone={unreachable || (report && !healthy) ? "down" : healthy ? "up" : "idle"}
          label={
            unreachable
              ? "API inalcanzable"
              : !report
                ? "comprobando…"
                : healthy
                  ? "operativa"
                  : "degradada"
          }
          emphasis
        />

        {report && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {DEPENDENCIES.map((dependency) => (
              <DependencyChip
                key={dependency}
                name={DEPENDENCY_LABEL[dependency]}
                up={report.checks[dependency]?.status === "up"}
                latencyMs={report.checks[dependency]?.latencyMs}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
        <Field label="runs" value={String(runCount)} />
        <Signal
          tone={streaming ? "up" : "idle"}
          label={streaming ? "en directo" : "sin stream"}
        />
        <Field label="seq" value={String(latestSequence)} />
      </div>
    </section>
  );
}

function Signal({
  tone,
  label,
  emphasis = false,
}: {
  tone: "up" | "down" | "idle";
  label: string;
  emphasis?: boolean;
}): JSX.Element {
  const dotClass =
    tone === "up"
      ? "bg-success"
      : tone === "down"
        ? "bg-danger"
        : "bg-slate-300 dark:bg-slate-600";

  return (
    <span className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${dotClass} ${tone === "up" && emphasis ? "status-pulse status-pulse-success" : ""}`}
        aria-hidden="true"
      />
      <span
        className={`font-mono text-xs ${emphasis ? "font-medium text-app-text" : "text-app-text-secondary"}`}
      >
        {label}
      </span>
    </span>
  );
}

function DependencyChip({
  name,
  up,
  latencyMs,
}: {
  name: string;
  up: boolean;
  latencyMs?: number;
}): JSX.Element {
  return (
    <span
      className={`data-meta rounded border px-1.5 py-0.5 ${
        up
          ? "border-app-border bg-app-bg-subtle text-app-text-muted"
          : "border-danger/30 bg-danger-subtle text-danger"
      }`}
      title={up && latencyMs !== undefined ? `${latencyMs} ms` : undefined}
    >
      {name} {up ? "ok" : "caído"}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="ui-label">{label}</span>
      <span className="data-figure text-sm font-semibold">{value}</span>
    </span>
  );
}
