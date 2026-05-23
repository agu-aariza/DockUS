import { pretty } from "../../shared/utils/errors";
import type {
  BuildRunEntity,
  BuildRunEvent,
  EvidenceArtifactDto,
} from "../../shared/types";
import type { StreamState } from "../hooks/useBuilderRunStream";
import { formatDate } from "../utils";
import { Button } from "../../shared/components/ui/Button";
import { Badge, Card } from "../../shared/components/ui/Layout";
import {
  RiPulseFill,
  RiLoader4Line,
  RiRefreshLine,
  RiStackFill,
  RiStopLine,
  RiPlayLine,
  RiEyeLine,
  RiEyeOffLine,
  RiDownloadLine,
} from "react-icons/ri";

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(" ");

const PREFLIGHT_COMPATIBILITY_LABEL: Record<string, string> = {
  SUPPORTED_AUTO: "soportado automaticamente",
  SUPPORTED_WITH_MANIFEST: "soportado mediante dockus.yml",
  PARTIAL: "parcial",
  UNSUPPORTED: "no soportado",
};

const ARTIFACT_LABELS: Record<string, string> = {
  BUILD_LOG: "Build log",
  RUNTIME_EVENTS: "Eventos del runtime",
  CONTAINER_INSPECT: "Estado del contenedor",
  CONTAINER_LOG: "Log del contenedor",
  TEST_LOG: "Log de tests",
  REPORT_TEXT: "Informe legible",
  REPORT_JSON: "Informe JSON",
  REPRODUCIBILITY_JSON: "Reproducibilidad",
  PREFLIGHT: "Preflight",
  CLASSIFICATION: "Clasificacion",
  STRATEGY: "Estrategia",
  STATIC_FINDINGS: "Hallazgos estaticos",
  STATIC_REVIEW: "Revision estatica",
  SELF_HEALING_TRACE: "Traza de autocorreccion",
  LLM_PLAN_PROMPT: "Prompt del planner",
  LLM_PLAN_RAW_RESPONSE: "Respuesta bruta del planner",
  LLM_PLAN_PARSED: "Planner normalizado",
  LLM_PLAN_ERROR: "Error del planner",
  LLM_EVAL_PROMPT: "Prompt de evaluacion",
  LLM_EVAL_RAW_RESPONSE: "Respuesta bruta de evaluacion",
  LLM_EVAL_PARSED: "Evaluacion normalizada",
  LLM_EVAL_ERROR: "Error de evaluacion",
  LLM_QUALITY_PROMPT: "Prompt de calidad",
  LLM_QUALITY_RAW_RESPONSE: "Respuesta bruta de calidad",
  LLM_QUALITY_PARSED: "Calidad normalizada",
  LLM_QUALITY_ERROR: "Error de calidad",
};

interface BuilderLiveRunPaneProps {
  selectedRun: BuildRunEntity | null;
  liveEvents: BuildRunEvent[];
  streamState: StreamState;
  streamError?: string | null;
  evidenceArtifacts?: EvidenceArtifactDto[];
  evidenceLoading?: boolean;
  evidenceError?: string | null;
  downloadingArtifactId?: string | null;
  previewingArtifact?: {
    id: string;
    type: string;
    contentType: string;
    content: string;
  } | null;
  previewLoading?: string | null;
  onPreviewArtifact?: (artifactId: string) => void;
  onClosePreview?: () => void;
  onDownloadArtifact?: (artifactId: string) => void;
  onRefresh: () => void;
  onCancel: () => void;
  busyAction: string | null;
}

const PREVIEWABLE_CONTENT_TYPES = new Set([
  "text/plain",
  "text/plain; charset=utf-8",
  "application/json",
  "application/json; charset=utf-8",
]);

function isPreviewable(contentType: string): boolean {
  return PREVIEWABLE_CONTENT_TYPES.has(contentType.toLowerCase());
}

function normalizeItems(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean);
}

function formatArtifactLabel(type: string): string {
  return ARTIFACT_LABELS[type] ?? type.replace(/_/g, " ");
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BuilderLiveRunPane({
  selectedRun,
  liveEvents,
  streamState,
  streamError = null,
  evidenceArtifacts = [],
  evidenceLoading = false,
  evidenceError = null,
  downloadingArtifactId = null,
  previewingArtifact = null,
  previewLoading = null,
  onPreviewArtifact,
  onClosePreview,
  onDownloadArtifact,
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

  const timelineEvents = liveEvents.filter(
    (event) => event.eventType !== "LOG_CHUNK",
  );
  const observedEvidence = normalizeItems(
    selectedRun?.llmAssessment?.observedEvidence,
  );
  const evaluationLimits = normalizeItems(
    selectedRun?.llmAssessment?.evaluationLimits,
  );
  const showAssessmentContext =
    observedEvidence.length > 0 || evaluationLimits.length > 0;

  const evidenceEmptyMessage = !selectedRun
    ? null
    : !selectedRun.isTerminal
      ? "Las evidencias descargables apareceran conforme avance la ejecucion."
      : selectedRun.status === "FAILED" || evaluationLimits.length > 0
        ? "El run termino con limites o fallos y no genero artefactos descargables adicionales."
        : "Este run termino sin artefactos descargables.";

  return (
    <Card
      title="Ejecucion en vivo"
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
            disabled={
              !selectedRun || selectedRun.isTerminal || busyAction === "cancel"
            }
            onClick={onCancel}
          >
            Cancelar
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex items-center gap-4 border-b border-academic-surface-variant/40 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-academic-outline">
            Contexto
          </span>
          <span className="rounded-md bg-academic-surface-container px-2 py-0.5 text-xs font-bold text-academic-on-surface-variant">
            {selectedRun?.runKind}
          </span>
        </div>
        <div className="h-4 w-px bg-academic-surface-variant/40" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-academic-outline">
            Arquitectura
          </span>
          <span className="rounded-md bg-brand-maroon/5 px-2 py-0.5 text-xs font-bold text-brand-maroon">
            {selectedRun?.llmAssessment?.structuralType ?? "Analizando..."}
          </span>
        </div>
      </div>

      {selectedRun ? (
        <>
          {streamError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              El stream en vivo encontro un error: {streamError}. El panel sigue
              disponible con refresco manual y polling.
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border border-academic-surface-variant/60 bg-white p-5 shadow-academic">
              <div className="absolute right-0 top-0 p-3 text-4xl text-academic-on-surface opacity-10">
                <RiPulseFill />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-academic-outline">
                Estado Ejecucion
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full",
                    selectedRun.status === "SUCCESS"
                      ? "bg-emerald-500 animate-pulse"
                      : selectedRun.status === "FAILED"
                        ? "bg-rose-500"
                        : "bg-brand-blue animate-bounce",
                  )}
                />
                <span className="text-2xl font-black tracking-tighter text-academic-on-surface">
                  {selectedRun.status}
                </span>
              </div>
              <div className="mt-2 text-xs font-bold text-academic-outline">
                Etapa:{" "}
                <span className="text-brand-maroon">
                  {selectedRun.activeStage ?? "Orquestando"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-academic-surface-variant/60 bg-white p-5 shadow-academic">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-academic-outline">
                Infraestructura
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-academic-outline">
                    Network
                  </span>
                  <span className="rounded border border-academic-surface-variant/40 bg-academic-surface px-2 py-0.5 text-[10px] font-mono font-bold text-academic-on-surface-variant">
                    {selectedRun.runtimeTarget?.executionNetworkName?.slice(0, 16) ??
                      "pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-academic-outline">
                    Container
                  </span>
                  <span className="rounded border border-brand-blue/10 bg-brand-blue/5 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-blue">
                    {selectedRun.runtimeTarget?.primaryContainerId?.slice(0, 12) ??
                      "resolving"}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-brand-gold/30 bg-brand-gold/[0.03] p-5 shadow-academic">
              <div className="absolute right-0 top-0 p-3 text-4xl text-brand-gold opacity-20">
                <RiRefreshLine
                  className={cn(
                    selectedRun.status !== "SUCCESS" &&
                      selectedRun.status !== "FAILED" &&
                      "animate-spin-slow",
                  )}
                />
              </div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold-dark">
                Evaluacion Academica
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-1">
                  <span
                    className={cn(
                      "text-4xl font-black tracking-tighter",
                      selectedRun.llmAssessment?.evaluativeState === "E1"
                        ? "text-emerald-600"
                        : selectedRun.llmAssessment?.evaluativeState === "E2"
                          ? "text-brand-gold-dark"
                          : "text-academic-outline",
                    )}
                  >
                    {selectedRun.llmAssessment?.evaluativeState ?? "--"}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-brand-gold-dark/60">
                    Eval
                  </span>
                </div>

                {selectedRun.llmAssessment?.recommendedGrade !== undefined ? (
                  <div
                    className={cn(
                      "flex scale-110 flex-col items-center justify-center rounded-xl border-2 px-4 py-1.5 shadow-lg",
                      selectedRun.llmAssessment.recommendedGrade >= 7
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                        : selectedRun.llmAssessment.recommendedGrade >= 5
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                          : "border-red-500/40 bg-red-500/10 text-red-600",
                    )}
                  >
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                      Nota Final
                    </span>
                    <span className="text-2xl font-black leading-none">
                      {selectedRun.llmAssessment.recommendedGrade.toFixed(2)}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-brand-gold/10 pt-2 text-[10px] font-bold uppercase tracking-widest text-brand-gold-dark/50">
                <span>
                  Confianza: {selectedRun.llmAssessment?.confidence ?? "n/a"}
                </span>
                {selectedRun.llmAssessment?.recommendedGrade !== undefined ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px]",
                      selectedRun.llmAssessment.recommendedGrade >= 5
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700",
                    )}
                  >
                    {selectedRun.llmAssessment.recommendedGrade >= 5
                      ? "Aprobado"
                      : "Suspenso"}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {selectedRun.llmAssessment ? (
            <section className="rounded-2xl border border-brand-maroon/10 bg-brand-maroon/[0.02] p-6 mb-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded bg-brand-maroon/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-maroon">
                      LLM Assessment
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        selectedRun.llmAssessment.confidence === "high"
                          ? "bg-emerald-100 text-emerald-700"
                          : selectedRun.llmAssessment.confidence === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-academic-surface text-academic-outline"
                      }`}
                    >
                      Confianza: {selectedRun.llmAssessment.confidence}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold tracking-tight text-academic-on-surface">
                    {selectedRun.llmAssessment.structuralType}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-academic-on-surface-variant">
                    {selectedRun.llmAssessment.rationale}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <div
                    className={cn(
                      "text-2xl font-black",
                      selectedRun.llmAssessment.evaluativeState === "E1"
                        ? "text-emerald-500"
                        : selectedRun.llmAssessment.evaluativeState === "E2"
                          ? "text-brand-gold"
                          : selectedRun.llmAssessment.evaluativeState === "E3"
                            ? "text-amber-500"
                            : "text-rose-500",
                    )}
                  >
                    {selectedRun.llmAssessment.evaluativeState}
                  </div>
                  <span className="ui-label text-academic-outline">Score de Calidad</span>
                </div>

                {selectedRun.llmAssessment.recommendedGrade !== undefined ? (
                  <div className="h-12 w-px bg-academic-surface-variant/40" />
                ) : null}

                {selectedRun.llmAssessment.recommendedGrade !== undefined ? (
                  <div className="flex flex-col items-end">
                    <div
                      className={cn(
                        "text-2xl font-black",
                        selectedRun.llmAssessment.recommendedGrade >= 7
                          ? "text-emerald-500"
                          : selectedRun.llmAssessment.recommendedGrade >= 5
                            ? "text-amber-500"
                            : "text-red-500",
                      )}
                    >
                      {selectedRun.llmAssessment.recommendedGrade.toFixed(2)}
                    </div>
                    <span className="ui-label text-academic-outline">Nota Final</span>
                  </div>
                ) : null}
              </div>

              {selectedRun.llmAssessment.evidenceSummary ? (
                <div className="mt-6 border-t border-academic-surface-variant/40 pt-4">
                  <div className="ui-label mb-2 text-academic-outline">
                    Evidencia Observada
                  </div>
                  <p className="text-xs italic leading-5 text-academic-outline">
                    {selectedRun.llmAssessment.evidenceSummary}
                  </p>
                </div>
              ) : null}

              {showAssessmentContext ? (
                <div className="mt-6 grid gap-4 border-t border-academic-surface-variant/40 pt-4 lg:grid-cols-2">
                  {observedEvidence.length > 0 ? (
                    <article className="rounded-2xl border border-emerald-200 bg-white/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                        Que observo el sistema
                      </div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-academic-on-surface-variant">
                        {observedEvidence.map((item) => (
                          <li
                            key={item}
                            className="rounded-xl bg-emerald-50 px-3 py-2"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ) : null}

                  {evaluationLimits.length > 0 ? (
                    <article className="rounded-2xl border border-amber-200 bg-white/80 p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Lo que no pudo validar
                      </div>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-academic-on-surface-variant">
                        {evaluationLimits.map((item) => (
                          <li
                            key={item}
                            className="rounded-xl bg-amber-50 px-3 py-2"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {selectedRun.preflightSummary ? (
            <section className="rounded-2xl border border-academic-surface-variant bg-academic-surface p-4 opacity-75 grayscale-[0.5] mb-6">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-academic-outline">
                    Legacy Preflight (Auto-detect)
                  </div>
                  <div className="mt-2 text-lg font-semibold tracking-tight text-academic-on-surface">
                    {selectedRun.preflightSummary.supportedProjectType}
                  </div>
                  <div className="mt-1 text-sm text-academic-on-surface-variant">
                    {PREFLIGHT_COMPATIBILITY_LABEL[
                      selectedRun.preflightSummary.compatibility
                    ] ?? selectedRun.preflightSummary.compatibility}
                    {" · perfil "}
                    {selectedRun.preflightSummary.executionProfile}
                    {" · gestor "}
                    {selectedRun.preflightSummary.dependencyManager}
                  </div>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-academic-on-surface-variant">
                <div>
                  <span className="font-semibold text-academic-on-surface">Working dir</span>
                  : {selectedRun.preflightSummary.workingDirectory}
                </div>
                <div>
                  <span className="font-semibold text-academic-on-surface">Run</span>:{" "}
                  {selectedRun.preflightSummary.resolvedCommands.run
                    ? selectedRun.preflightSummary.resolvedCommands.run.join(" ")
                    : "sin comando"}
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-academic-surface-variant bg-white p-4 shadow-academic mb-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-medium text-academic-on-surface">
                  Evidencias del run
                </div>
                <div className="text-xs text-academic-outline">
                  Artefactos persistidos para auditoria del profesorado. Haz
                  clic en "Ver" para inspeccionar en línea.
                </div>
              </div>
              {selectedRun.isTerminal ? (
                <Badge variant="idle">Run cerrado</Badge>
              ) : (
                <Badge variant="warning">Run en progreso</Badge>
              )}
            </div>

            {evidenceLoading ? (
              <div className="mt-4 rounded-2xl border border-dashed border-academic-surface-variant bg-academic-surface px-4 py-8 text-center text-sm text-academic-outline">
                Cargando evidencias disponibles...
              </div>
            ) : evidenceError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                No se pudo cargar la lista de evidencias: {evidenceError}
              </div>
            ) : evidenceArtifacts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-academic-surface-variant bg-academic-surface px-4 py-8 text-center text-sm text-academic-outline">
                {evidenceEmptyMessage}
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {evidenceArtifacts.map((artifact) => {
                    const previewing = previewingArtifact?.id === artifact.id;
                    const loading = previewLoading === artifact.id;
                    const canPreview = isPreviewable(artifact.contentType);

                    return (
                      <article
                        key={artifact.id}
                        className={cn(
                          "rounded-2xl border p-4 transition-all duration-200",
                          previewing
                            ? "border-brand-blue/40 bg-brand-blue/[0.03] ring-1 ring-brand-blue/20"
                            : "border-academic-surface-variant bg-academic-surface hover:border-academic-outline-variant",
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-academic-on-surface">
                              {formatArtifactLabel(artifact.type)}
                            </div>
                            <div className="mt-1 text-xs font-mono text-academic-outline">
                              {artifact.type}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canPreview ? (
                              <Button
                                variant={previewing ? "primary" : "secondary"}
                                className="px-3 py-1.5 text-xs"
                                disabled={loading}
                                onClick={() => onPreviewArtifact?.(artifact.id)}
                              >
                                {loading ? (
                                  <RiLoader4Line className="animate-spin" />
                                ) : previewing ? (
                                  <RiEyeOffLine />
                                ) : (
                                  <RiEyeLine />
                                )}
                                {loading
                                  ? "Cargando..."
                                  : previewing
                                    ? "Ocultar"
                                    : "Ver"}
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              className="px-3 py-1.5 text-xs"
                              disabled={
                                downloadingArtifactId === artifact.id ||
                                typeof onDownloadArtifact !== "function"
                              }
                              onClick={() => onDownloadArtifact?.(artifact.id)}
                            >
                              <RiDownloadLine />
                              {downloadingArtifactId === artifact.id
                                ? "..."
                                : "Descargar"}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs text-academic-outline sm:grid-cols-3">
                          <div>
                            <span className="font-semibold text-academic-on-surface-variant">Tipo</span>
                            <div>{artifact.contentType}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-academic-on-surface-variant">Tamano</span>
                            <div>{formatBytes(artifact.sizeBytes)}</div>
                          </div>
                          <div>
                            <span className="font-semibold text-academic-on-surface-variant">Creado</span>
                            <div>{formatDate(artifact.createdAt)}</div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {previewingArtifact ? (
                  <div className="mt-4 animate-fade-in overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-xl">
                    <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {formatArtifactLabel(previewingArtifact.type)}
                        </span>
                        <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
                          {previewingArtifact.contentType}
                        </span>
                      </div>
                      <button
                        onClick={onClosePreview}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
                      >
                        ×
                      </button>
                    </div>
                    <pre className="custom-scrollbar max-h-[500px] overflow-auto p-4 font-mono text-[11px] leading-6 text-slate-300 selection:bg-brand-blue/30">
                      <code>
                        {previewingArtifact.contentType.includes("json")
                          ? (() => {
                              try {
                                return JSON.stringify(
                                  JSON.parse(previewingArtifact.content),
                                  null,
                                  2,
                                );
                              } catch {
                                return previewingArtifact.content;
                              }
                            })()
                          : previewingArtifact.content}
                      </code>
                    </pre>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
            <section className="min-w-0 rounded-2xl border border-academic-surface-variant/40 bg-slate-950 p-4 shadow-academic">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <RiPulseFill
                      className={streamState === "streaming" ? "animate-pulse" : ""}
                    />
                  </div>
                  <div>
                    <div className="font-display text-sm font-bold tracking-tight text-slate-100">
                      Consola en vivo
                    </div>
                    <div className="text-[10px] font-medium uppercase tracking-widest text-academic-outline">
                      Build & Runtime Logs
                    </div>
                  </div>
                </div>
                {streamState === "streaming" ? (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-bold uppercase text-emerald-500">
                      Streaming
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="group relative">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent opacity-20 transition-opacity group-hover:opacity-30" />
                <pre className="custom-scrollbar max-h-[460px] max-w-full overflow-y-auto whitespace-pre-wrap break-all p-2 font-mono text-[11px] leading-6 text-emerald-300/90 selection:bg-emerald-500/30">
                  {consoleOutput || (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-academic-outline">
                      <RiLoader4Line className="text-3xl animate-spin" />
                      <span className="text-xs font-medium italic">
                        Esperando rafaga de logs del orquestador...
                      </span>
                    </div>
                  )}
                </pre>
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-academic-surface-variant/60 bg-academic-surface p-4 shadow-academic">
              <div className="mb-3">
                <div className="text-sm font-medium text-academic-on-surface">
                  Linea temporal de la ejecucion
                </div>
                <div className="text-xs text-academic-outline">
                  Eventos persistidos fuera del stream de consola
                </div>
              </div>

              <div className="custom-scrollbar max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-academic-surface-variant bg-white px-4 py-8 text-center text-sm text-academic-outline">
                    Aun no hay eventos visibles para este run.
                  </div>
                ) : (
                  timelineEvents.map((event) => {
                    const isEvidence = event.message?.includes(
                      "--- HEALTHCHECK EVIDENCE ---",
                    );
                    const evidenceMatch = event.message?.match(
                      /--- HEALTHCHECK EVIDENCE ---\n([\s\S]*)/,
                    );
                    const evidenceContent = evidenceMatch ? evidenceMatch[1] : null;
                    const cleanMessage = isEvidence
                      ? event.message.split("--- HEALTHCHECK EVIDENCE ---")[0].trim()
                      : event.message;

                    const isError =
                      event.eventType.includes("ERROR") ||
                      event.message?.toLowerCase().includes("error") ||
                      event.message?.toLowerCase().includes("failed");
                    const isSuccess =
                      event.eventType.includes("COMPLETED") ||
                      event.eventType.includes("SUCCESS");
                    const isSystem =
                      event.eventType.includes("START") ||
                      event.eventType.includes("ENQUEUED");
                    const isIA =
                      event.message?.includes("IA") || event.message?.includes("LLM");

                    let sidebarColor = "bg-academic-outline";
                    let icon = <RiStackFill />;
                    let iconBg = "bg-academic-surface text-academic-outline";

                    if (isEvidence) {
                      sidebarColor = "bg-emerald-500";
                      icon = <RiPulseFill />;
                      iconBg = "bg-emerald-500 text-white animate-pulse";
                    } else if (isError) {
                      sidebarColor = "bg-rose-500";
                      icon = <RiStopLine />;
                      iconBg = "bg-rose-100 text-rose-600";
                    } else if (isSuccess) {
                      sidebarColor = "bg-emerald-500";
                      icon = <RiPulseFill />;
                      iconBg = "bg-emerald-100 text-emerald-600";
                    } else if (isIA) {
                      sidebarColor = "bg-brand-gold";
                      icon = <RiRefreshLine />;
                      iconBg = "bg-brand-gold/10 text-brand-gold-dark";
                    } else if (isSystem) {
                      sidebarColor = "bg-brand-blue";
                      icon = <RiPlayLine />;
                      iconBg = "bg-brand-blue/10 text-brand-blue-dark";
                    }

                    return (
                      <article
                        key={event.id}
                        className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:shadow-md ${
                          isEvidence
                            ? "border-emerald-200 bg-emerald-50/30 ring-1 ring-emerald-100"
                            : isError
                              ? "border-rose-100 bg-rose-50/30"
                              : "border-academic-surface-variant/40 bg-white"
                        }`}
                      >
                        <div
                          className={`absolute bottom-0 left-0 top-0 w-1.5 ${sidebarColor} opacity-80 transition-opacity group-hover:opacity-100`}
                        />

                        <div className="ml-2 flex items-start justify-between gap-4">
                          <div className="flex gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm transition-transform group-hover:scale-110`}
                            >
                              {icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <strong
                                  className={`text-xs font-black uppercase tracking-widest ${
                                    isEvidence
                                      ? "text-emerald-700"
                                      : isError
                                        ? "text-rose-700"
                                        : "text-academic-on-surface"
                                  }`}
                                >
                                  {isEvidence ? "Proof of Life Verified" : event.eventType}
                                </strong>
                                {isIA ? (
                                  <span className="rounded bg-brand-gold/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-brand-gold-dark">
                                    AI Enhanced
                                  </span>
                                ) : null}
                              </div>
                              <p
                                className={`mt-1.5 text-sm leading-relaxed ${
                                  isEvidence
                                    ? "font-bold text-emerald-900"
                                    : isError
                                      ? "text-rose-900"
                                      : "text-academic-on-surface-variant"
                                }`}
                              >
                                {cleanMessage}
                              </p>
                            </div>
                          </div>
                          <span className="whitespace-nowrap rounded-lg bg-academic-surface px-2 py-1 text-[10px] font-bold text-academic-outline">
                            {formatDate(event.createdAt)}
                          </span>
                        </div>

                        {isEvidence && evidenceContent ? (
                          <div className="mt-4 ml-11 overflow-hidden rounded-xl border border-emerald-200 bg-slate-950 shadow-inner">
                            <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/50 px-3 py-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                                Service Response Evidence
                              </span>
                              <div className="flex gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-700" />
                              </div>
                            </div>
                            <pre className="max-w-full overflow-x-auto p-4 font-mono text-[11px] leading-5 text-emerald-400">
                              {evidenceContent.trim()}
                            </pre>
                          </div>
                        ) : null}

                        {event.payload && !isEvidence ? (
                          <div className="mt-3 ml-11">
                            <div className="mb-1 ml-1 text-[10px] font-bold uppercase tracking-widest text-academic-outline">
                              Payload Data
                            </div>
                            <pre className="max-w-full overflow-x-auto rounded-xl border border-academic-surface-variant/40 bg-slate-950 p-3 text-[10px] text-slate-300 shadow-inner">
                              {pretty(event.payload)}
                            </pre>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-academic-surface-variant bg-academic-surface px-4 py-10 text-center text-sm text-academic-outline">
          Selecciona una ejecucion del historial para abrir la consola y la
          linea temporal.
        </div>
      )}
    </Card>
  );
}
