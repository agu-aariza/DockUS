import { pretty } from "../../shared/utils/errors";
import type { BuildRunEntity, BuildRunEvent } from "../../shared/types";
import type { StreamState } from "../hooks/useBuilderRunStream";
import { formatDate, summarizeRun } from "../utils";
import { Button } from "../../shared/components/ui/Button";
import { Badge, Card } from "../../shared/components/ui/Layout";
import {
  RiPulseFill,
  RiLoader4Line,
  RiRefreshLine,
  RiStackFill,
  RiStopLine,
  RiPlayLine,
} from "react-icons/ri";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

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
      <div className="flex items-center gap-4 py-2 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contexto</span>
          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{selectedRun?.runKind}</span>
        </div>
        <div className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Arquitectura</span>
          <span className="text-xs font-bold text-brand-maroon bg-brand-maroon/5 px-2 py-0.5 rounded-md">{selectedRun?.llmAssessment?.structuralType ?? 'Analizando...'}</span>
        </div>
      </div>

      {selectedRun ? (
        <>
          <div className="grid gap-4 mb-6 md:grid-cols-3">
            {/* ESTADO EJECUCION */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="absolute top-0 right-0 p-3 opacity-10 text-4xl text-slate-900">
                <RiPulseFill />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Estado Ejecución</div>
              <div className="mt-2 flex items-center gap-3">
                <div className={cn(
                  "h-3 w-3 rounded-full",
                  selectedRun.status === 'SUCCESS' ? 'bg-emerald-500 animate-pulse' : 
                  selectedRun.status === 'FAILED' ? 'bg-rose-500' : 'bg-brand-blue animate-bounce'
                )} />
                <span className="text-2xl font-black tracking-tighter text-slate-900">{selectedRun.status}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-500">
                Etapa: <span className="text-brand-maroon">{selectedRun.activeStage ?? "Orquestando"}</span>
              </div>
            </div>

            {/* ENTORNO DOCKER */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Infraestructura</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Network</span>
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    {selectedRun.runtimeTarget?.executionNetworkName?.slice(0, 16) ?? "pending"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Container</span>
                  <span className="text-[10px] font-mono font-bold text-brand-blue bg-brand-blue/5 px-2 py-0.5 rounded border border-brand-blue/10">
                    {selectedRun.runtimeTarget?.primaryContainerId?.slice(0, 12) ?? "resolving"}
                  </span>
                </div>
              </div>
            </div>

            {/* RESULTADO ACADEMICO */}
            <div className="relative overflow-hidden rounded-2xl border border-brand-gold/20 bg-brand-gold/[0.03] p-5 shadow-sm transition-all hover:shadow-md">
              <div className="absolute top-0 right-0 p-3 opacity-20 text-4xl text-brand-gold">
                <RiRefreshLine className={cn(selectedRun.status !== 'SUCCESS' && selectedRun.status !== 'FAILED' ? "animate-spin-slow" : "")} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-gold-dark mb-2">Evaluación Académica</div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-baseline gap-1">
                  <span className={cn(
                    "text-4xl font-black tracking-tighter",
                    selectedRun.llmAssessment?.evaluativeState === 'E1' ? 'text-emerald-600' : 
                    selectedRun.llmAssessment?.evaluativeState === 'E2' ? 'text-brand-gold-dark' : 'text-slate-400'
                  )}>
                    {selectedRun.llmAssessment?.evaluativeState ?? "--"}
                  </span>
                  <span className="text-[10px] font-bold text-brand-gold-dark/60 uppercase">Eval</span>
                </div>

                {selectedRun.llmAssessment?.recommendedGrade !== undefined && (
                  <div className={cn(
                    "flex flex-col items-center justify-center px-4 py-1.5 rounded-xl border-2 shadow-lg scale-110",
                    selectedRun.llmAssessment.recommendedGrade >= 7 ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600" :
                    selectedRun.llmAssessment.recommendedGrade >= 5 ? "bg-amber-500/10 border-amber-500/40 text-amber-600" :
                    "bg-red-500/10 border-red-500/40 text-red-600"
                  )}>
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Nota Final</span>
                    <span className="text-2xl font-black leading-none">{selectedRun.llmAssessment.recommendedGrade.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-brand-gold/10 pt-2 text-[10px] font-bold text-brand-gold-dark/50 uppercase tracking-widest">
                <span>Confianza: {selectedRun.llmAssessment?.confidence ?? 'n/a'}</span>
                {selectedRun.llmAssessment?.recommendedGrade !== undefined && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[9px]",
                    selectedRun.llmAssessment.recommendedGrade >= 5 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                  )}>
                    {selectedRun.llmAssessment.recommendedGrade >= 5 ? "Aprobado" : "Suspenso"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {selectedRun.llmAssessment ? (
            <section className="rounded-2xl border border-brand-maroon/10 bg-brand-maroon/[0.02] p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-maroon px-2 py-0.5 bg-brand-maroon/10 rounded">
                      LLM Assessment
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      selectedRun.llmAssessment.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' :
                      selectedRun.llmAssessment.confidence === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      Confianza: {selectedRun.llmAssessment.confidence}
                    </span>
                  </div>
                  <h4 className="text-xl font-bold tracking-tight text-slate-900">
                    {selectedRun.llmAssessment.structuralType}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedRun.llmAssessment.rationale}
                  </p>
                </div>
                  <div className="flex flex-col items-end">
                    <div className={cn(
                      "text-2xl font-black",
                      selectedRun.llmAssessment.evaluativeState === 'E1' ? 'text-emerald-500' :
                      selectedRun.llmAssessment.evaluativeState === 'E2' ? 'text-brand-gold' :
                      selectedRun.llmAssessment.evaluativeState === 'E3' ? 'text-amber-500' :
                      'text-rose-500'
                    )}>
                      {selectedRun.llmAssessment.evaluativeState}
                    </div>
                    <span className="ui-label text-slate-400">Score de Calidad</span>
                  </div>

                  {selectedRun.llmAssessment.recommendedGrade !== undefined && (
                    <div className="h-12 w-px bg-slate-200" />
                  )}

                  {selectedRun.llmAssessment.recommendedGrade !== undefined && (
                    <div className="flex flex-col items-end">
                      <div className={cn(
                        "text-2xl font-black",
                        selectedRun.llmAssessment.recommendedGrade >= 7 ? "text-emerald-500" :
                        selectedRun.llmAssessment.recommendedGrade >= 5 ? "text-amber-500" :
                        "text-red-500"
                      )}>
                        {selectedRun.llmAssessment.recommendedGrade.toFixed(2)}
                      </div>
                      <span className="ui-label text-slate-400">Nota Final</span>
                    </div>
                  )}
                </div>

              {selectedRun.llmAssessment.evidenceSummary && (
                <div className="mt-6 border-t border-slate-200/60 pt-4">
                  <div className="ui-label mb-2 text-slate-500">Evidencia Observada</div>
                  <p className="text-xs leading-5 text-slate-500 italic">
                    {selectedRun.llmAssessment.evidenceSummary}
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {selectedRun.preflightSummary ? (
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-75 grayscale-[0.5]">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    Legacy Preflight (Auto-detect)
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
              </div>
            </section>
          ) : null}

          <div className="grid gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <RiPulseFill className={streamState === 'streaming' ? 'animate-pulse' : ''} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-100 tracking-tight">Consola en vivo</div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
                      Build & Runtime Logs
                    </div>
                  </div>
                </div>
                {streamState === 'streaming' && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Streaming</span>
                  </div>
                )}
              </div>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity" />
                <pre className="max-h-[460px] max-w-full overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-6 text-emerald-300/90 p-2 custom-scrollbar selection:bg-emerald-500/30">
                  {consoleOutput || (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600 gap-3">
                      <RiLoader4Line className="text-3xl animate-spin" />
                      <span className="text-xs font-medium italic">Esperando ráfaga de logs del orquestador...</span>
                    </div>
                  )}
                </pre>
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3">
                <div className="text-sm font-medium text-slate-950">Línea temporal de la ejecución</div>
                <div className="text-xs text-slate-500">
                  Eventos persistidos fuera del stream de consola
                </div>
              </div>

              <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                {timelineEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Aún no hay eventos visibles para este run.
                  </div>
                ) : (
                  timelineEvents.map((event) => {
                    const isEvidence = event.message?.includes("--- HEALTHCHECK EVIDENCE ---");
                    const evidenceMatch = event.message?.match(/--- HEALTHCHECK EVIDENCE ---\n([\s\S]*)/);
                    const evidenceContent = evidenceMatch ? evidenceMatch[1] : null;
                    const cleanMessage = isEvidence 
                      ? event.message.split("--- HEALTHCHECK EVIDENCE ---")[0].trim() 
                      : event.message;

                    // Determinación de color y estilo por tipo de evento
                    const isError = event.eventType.includes("ERROR") || event.message?.toLowerCase().includes("error") || event.message?.toLowerCase().includes("failed");
                    const isSuccess = event.eventType.includes("COMPLETED") || event.eventType.includes("SUCCESS");
                    const isSystem = event.eventType.includes("START") || event.eventType.includes("ENQUEUED");
                    const isIA = event.message?.includes("IA") || event.message?.includes("LLM");

                    let sidebarColor = "bg-slate-300";
                    let icon = <RiStackFill />;
                    let iconBg = "bg-slate-100 text-slate-500";

                    if (isEvidence) { sidebarColor = "bg-emerald-500"; icon = <RiPulseFill />; iconBg = "bg-emerald-500 text-white animate-pulse"; }
                    else if (isError) { sidebarColor = "bg-rose-500"; icon = <RiStopLine />; iconBg = "bg-rose-100 text-rose-600"; }
                    else if (isSuccess) { sidebarColor = "bg-emerald-500"; icon = <RiPulseFill />; iconBg = "bg-emerald-100 text-emerald-600"; }
                    else if (isIA) { sidebarColor = "bg-brand-gold"; icon = <RiRefreshLine />; iconBg = "bg-brand-gold/10 text-brand-gold-dark"; }
                    else if (isSystem) { sidebarColor = "bg-brand-blue"; icon = <RiPlayLine />; iconBg = "bg-brand-blue/10 text-brand-blue-dark"; }

                    return (
                      <article
                        key={event.id}
                        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-md ${
                          isEvidence 
                            ? "border-emerald-200 bg-emerald-50/30 ring-1 ring-emerald-100" 
                            : isError 
                              ? "border-rose-100 bg-rose-50/30"
                              : "border-slate-200 bg-white"
                        } p-4`}
                      >
                        {/* Barra lateral de color */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${sidebarColor} opacity-80 group-hover:opacity-100 transition-opacity`} />
                        
                        <div className="flex items-start justify-between gap-4 ml-2">
                          <div className="flex gap-3">
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg} shadow-sm transition-transform group-hover:scale-110`}>
                              {icon}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <strong className={`text-xs font-black uppercase tracking-widest ${
                                  isEvidence ? "text-emerald-700" : isError ? "text-rose-700" : "text-slate-900"
                                }`}>
                                  {isEvidence ? "Proof of Life Verified" : event.eventType}
                                </strong>
                                {isIA && <span className="text-[9px] font-bold bg-brand-gold/20 text-brand-gold-dark px-1.5 py-0.5 rounded uppercase">AI Enhanced</span>}
                              </div>
                              <p className={`mt-1.5 text-sm leading-relaxed ${
                                isEvidence ? "font-bold text-emerald-900" : isError ? "text-rose-900" : "text-slate-600"
                              }`}>
                                {cleanMessage}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded-lg">
                            {formatDate(event.createdAt)}
                          </span>
                        </div>

                        {isEvidence && evidenceContent && (
                          <div className="mt-4 ml-11 overflow-hidden rounded-xl border border-emerald-200 bg-slate-950 shadow-inner">
                            <div className="flex items-center justify-between bg-slate-900/50 px-3 py-1.5 border-b border-white/5">
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
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
                        )}

                        {event.payload && !isEvidence ? (
                          <div className="mt-3 ml-11">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Payload Data</div>
                            <pre className="max-w-full overflow-x-auto rounded-xl bg-slate-900 p-3 text-[10px] text-slate-300 border border-white/5 shadow-inner">
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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          Selecciona una ejecución del historial para abrir la consola y la línea temporal.
        </div>
      )}
    </Card>
  );
}
