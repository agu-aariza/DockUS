import { pretty } from "../../shared/utils/errors";
import type { BuildRunEntity, BuildRunEvent } from "../../shared/types";
import type { StreamState } from "../hooks/useBuilderRunStream";
import { formatDate, summarizeRun } from "../utils";
import { Button } from "../../shared/components/ui/Button";
import { Badge, Card } from "../../shared/components/ui/Layout";

const PREFLIGHT_COMPATIBILITY_LABEL: Record<string, string> = {
  SUPPORTED_AUTO: "soportado automáticamente",
  SUPPORTED_WITH_MANIFEST: "soportado mediante dockus.yml",
  PARTIAL: "parcial",
  UNSUPPORTED: "no soportado",
};

interface BuilderLiveRunPaneProps {
  selectedRun: BuildRunEntity | null;
  liveEvents: BuildRunEvent[];
  streamState: StreamState;
  onRefresh: () => void;
  onCancel: () => void;
  busyAction: string | null;
}

export function BuilderLiveRunPane({
  selectedRun,
  liveEvents,
  streamState,
  onRefresh,
  onCancel,
  busyAction,
}: BuilderLiveRunPaneProps): JSX.Element {
  const consoleOutput = liveEvents
    .filter((event) => event.eventType === "LOG_CHUNK")
    .map((event) =>
      typeof event.payload?.text === "string" ? event.payload.text : "",
    )
    .filter(Boolean)
    .reverse()
    .join("");

  const timelineEvents = liveEvents.filter((event) => event.eventType !== "LOG_CHUNK");

  return (
    <Card
      title="Ejecución en vivo"
      className="min-w-0 rounded-3xl"
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={streamState === "streaming" ? "success" : "warning"}>
            {streamState}
          </Badge>
          <Button variant="ghost" disabled={!selectedRun} onClick={onRefresh}>
            Refrescar
          </Button>
          <Button
            variant="danger"
            disabled={!selectedRun || selectedRun.isTerminal || busyAction === "cancel"}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-6 text-slate-600">{summarizeRun(selectedRun)}</p>

      {selectedRun ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Estado
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                {selectedRun.status}
              </div>
              <div className="mt-2 text-sm text-slate-600">
                Etapa activa: {selectedRun.activeStage ?? "n/d"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Entorno de ejecución
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-700">
                <div>
                  <span className="font-medium text-slate-950">Cluster:</span>{" "}
                  {selectedRun.runtimeTarget?.clusterName ?? "n/d"}
                </div>
                <div>
                  <span className="font-medium text-slate-950">Namespace:</span>{" "}
                  {selectedRun.runtimeTarget?.namespace ?? "n/d"}
                </div>
                <div>
                  <span className="font-medium text-slate-950">Pod principal:</span>{" "}
                  {selectedRun.runtimeTarget?.primaryPodName ?? "resolviendo"}
                </div>
              </div>
            </div>
          </div>

          {selectedRun.preflightSummary ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Preflight
                  </div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                    {selectedRun.preflightSummary.supportedProjectType}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {PREFLIGHT_COMPATIBILITY_LABEL[selectedRun.preflightSummary.compatibility] ??
                      selectedRun.preflightSummary.compatibility}
                    {" · perfil "}
                    {selectedRun.preflightSummary.executionProfile}
                    {" · gestor "}
                    {selectedRun.preflightSummary.dependencyManager}
                  </div>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedRun.preflightSummary.manifestSource === "DOCKUS_MANIFEST"
                    ? selectedRun.preflightSummary.manifestPath ?? "dockus.yml"
                    : selectedRun.preflightSummary.entrypointCandidates.length > 0
                      ? selectedRun.preflightSummary.entrypointCandidates.join(", ")
                      : "sin entrypoint"}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-slate-600">
                <div>
                  <span className="font-semibold text-slate-900">Working dir</span>:{" "}
                  {selectedRun.preflightSummary.workingDirectory}
                </div>
                <div>
                  <span className="font-semibold text-slate-900">Run</span>:{" "}
                  {selectedRun.preflightSummary.resolvedCommands.run
                    ? selectedRun.preflightSummary.resolvedCommands.run.join(" ")
                    : "sin comando"}
                </div>
                {selectedRun.preflightSummary.findings.length === 0 ? (
                  <div>Sin hallazgos adicionales.</div>
                ) : (
                  selectedRun.preflightSummary.findings.slice(0, 6).map((finding) => (
                    <div key={`${finding.code}-${finding.file ?? "global"}-${finding.line ?? 0}`}>
                      <span className="font-semibold text-slate-900">{finding.code}</span>: {finding.message}
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-100">Consola en vivo</div>
                  <div className="text-xs text-slate-400">
                    Logs concatenados de build, runtime y tests
                  </div>
                </div>
              </div>
              <pre className="max-h-[420px] max-w-full overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-emerald-300">
                {consoleOutput || "Esperando eventos LOG_CHUNK..."}
              </pre>
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <div className="text-sm font-medium text-slate-950">Línea temporal de la ejecución</div>
                <div className="text-xs text-slate-500">
                  Eventos persistidos fuera del stream de consola
                </div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto">
                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Aún no hay eventos visibles para este run.
                  </div>
                ) : (
                  timelineEvents.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm font-medium text-slate-950">
                          {event.eventType}
                        </strong>
                        <span className="text-xs text-slate-500">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {event.message}
                      </p>
                      {event.payload ? (
                        <pre className="mt-3 max-w-full overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-200">
                          {pretty(event.payload)}
                        </pre>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Selecciona una ejecución del historial para abrir la consola y la línea temporal.
        </div>
      )}
    </Card>
  );
}
