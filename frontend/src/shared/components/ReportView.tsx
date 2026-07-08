import { useState, useEffect } from "react";
import { builderApi } from "../api/builderApi";
import type { BuilderPreflightSummary, BuilderReportEntity, BuilderRuntimeFamily, BuildRunEntity, TechnicalFeedbackItem } from "../../features/builder/types";
import {
  RiAlarmWarningLine,
  RiCheckLine,
  RiCloseLine,
  RiCodeSSlashLine,
  RiDashboardLine,
  RiFileList3Line,
  RiInformationLine,
  RiLightbulbFlashLine,
  RiPrinterLine,
  RiShieldCheckLine,
  RiSparklingLine,
  RiTerminalBoxLine,
} from "react-icons/ri";

import { AssessmentContextSummary } from "./AssessmentContextSummary";
import { CoachingSummary } from "./CoachingSummary";
import { GlossaryTerm } from "./Glossary";
import { GradeBreakdownChart } from "./GradeBreakdownChart";
import { MarkdownContent } from "./MarkdownContent";
import { PedagogicalReport } from "./PedagogicalReport";
import { TeacherHighlights } from "./TeacherHighlights";
import { TerminalViewer } from "./TerminalViewer";
import { TutorChatBlock } from "./TutorChatBlock";
import { normalizeTechnicalFeedbackItem } from "../utils/technicalFeedback";
import { ReportCard } from "./report/ReportCard";
import { ReportHeader } from "./report/ReportHeader";
import { TechnicalFindingCard } from "./report/TechnicalFindingCard";

interface ReportViewProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
  mode?: "student" | "teacher";
}

const AXIS_ICON: Record<string, typeof RiShieldCheckLine> = {
  Seguridad: RiShieldCheckLine,
  Arquitectura: RiCodeSSlashLine,
  Calidad: RiSparklingLine,
  "Calidad y Estilo": RiSparklingLine,
  "Cumplimiento de rubrica": RiInformationLine,
  Rubrica: RiInformationLine,
};

const PREFLIGHT_COMPATIBILITY_LABEL: Record<string, string> = {
  SUPPORTED_AUTO: "soportado automáticamente",
  SUPPORTED_WITH_MANIFEST: "soportado mediante dockus.yml",
  PARTIAL: "parcial",
  UNSUPPORTED: "no soportado",
};

const PREFLIGHT_PROJECT_TYPE_LABEL: Record<string, string> = {
  CLI: "CLI script",
  MODULE_CLI: "CLI por modulo",
  WEB_ASGI: "Servicio ASGI",
  WEB_WSGI: "Servicio WSGI",
  DJANGO_SERVICE: "Servicio Django",
  BATCH_WORKER: "Worker batch",
  PYPROJECT_GENERIC: "Proyecto pyproject generico",
  CUSTOM_MANIFEST: "Contrato custom",
  UNKNOWN: "Tipo sin resolver",
};

function PreflightSummaryBlock({
  preflight,
}: {
  preflight: BuilderPreflightSummary;
}): JSX.Element {
  const statusTone =
    preflight.compatibility === "SUPPORTED_AUTO" ||
    preflight.compatibility === "SUPPORTED_WITH_MANIFEST"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : preflight.compatibility === "PARTIAL"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <ReportCard
      tone="default"
      title="Preflight Python-first"
      description={PREFLIGHT_PROJECT_TYPE_LABEL[preflight.supportedProjectType] ??
        preflight.supportedProjectType}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <p className="text-sm text-slate-600">
          {PREFLIGHT_COMPATIBILITY_LABEL[preflight.compatibility] ??
            preflight.compatibility}{" "}
          · perfil {preflight.executionProfile} · gestor{" "}
          {preflight.dependencyManager}
        </p>
        <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 border border-app-border">
          {preflight.manifestSource === "DOCKUS_MANIFEST"
            ? `Manifest ${preflight.manifestPath ?? "dockus.yml"}`
            : preflight.entrypointCandidates.length > 0
              ? `${preflight.entrypointCandidates.length} entrypoint(s)`
              : "Sin entrypoint claro"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className={`rounded-xl border p-4 text-sm ${statusTone}`}>
          <div className="font-semibold">Señales detectadas</div>
          <ul className="mt-3 space-y-2">
            <li>Tests detectados: {preflight.testsPresent ? "si" : "no"}</li>
            <li>Working dir: {preflight.workingDirectory}</li>
            <li>
              Entrypoints:{" "}
              {preflight.entrypointCandidates.length > 0
                ? preflight.entrypointCandidates.join(", ")
                : "sin candidatos claros"}
            </li>
            <li>Framework: {preflight.detectedFramework ?? "sin framework claro"}</li>
            {preflight.failureCode ? (
              <li>Motivo técnico: {preflight.failureCode}</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-app-border bg-white p-4 text-sm">
          <div className="font-semibold text-slate-900">Plan resuelto</div>
          <ul className="mt-3 space-y-2 break-all text-slate-600">
            <li>
              Run:{" "}
              {preflight.resolvedCommands.run
                ? preflight.resolvedCommands.run.join(" ")
                : "sin comando"}
            </li>
            <li>
              Install:{" "}
              {preflight.resolvedCommands.install.length > 0
                ? preflight.resolvedCommands.install
                  .map((command) => command.join(" "))
                  .join(" · ")
                : "sin instalacion"}
            </li>
            <li>
              Healthcheck:{" "}
              {preflight.resolvedCommands.healthcheck
                ? preflight.resolvedCommands.healthcheck.join(" ")
                : "sin healthcheck"}
            </li>
          </ul>
        </div>
        <div className="rounded-xl border border-app-border bg-white p-4 text-sm">
          <div className="font-semibold text-slate-900">Findings del preflight</div>
          <div className="mt-3 space-y-2 text-slate-600">
            {preflight.findings.length === 0 ? (
              <p>Sin hallazgos adicionales.</p>
            ) : (
              preflight.findings.slice(0, 6).map((finding) => (
                <div key={`${finding.code}-${finding.file ?? "global"}-${finding.line ?? 0}`}>
                  <span className="font-semibold">{finding.code}</span>:{" "}
                  {finding.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </ReportCard>
  );
}

function FeedbackAxis({
  title,
  items,
  runtimeFamily,
}: {
  title: string;
  items: TechnicalFeedbackItem[];
  runtimeFamily?: BuilderRuntimeFamily;
}): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  const AxisIcon = AXIS_ICON[title] ?? RiInformationLine;
  const normalizedItems = items.map((item) => normalizeTechnicalFeedbackItem(item));

  const highItems = normalizedItems.filter((i) => i.severity === "high");
  const lowerItems = normalizedItems.filter((i) => i.severity !== "high");

  return (
    <div className="mt-6">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
        <AxisIcon className="text-base" aria-hidden="true" />
        {title}
      </h4>
      <div className="space-y-3">
        {highItems.map((item, index) => (
          <TechnicalFindingCard
            key={`high-${item.title}-${index}`}
            item={item}
            runtimeFamily={runtimeFamily}
          />
        ))}
        {lowerItems.length > 0 ? (
          <details className="rounded-xl border border-app-border bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900">
              {lowerItems.length} observaci{lowerItems.length === 1 ? "ón" : "ones"} de prioridad media/baja
            </summary>
            <div className="space-y-3 px-4 pb-4 pt-1">
              {lowerItems.map((item, index) => (
                <TechnicalFindingCard
                  key={`lower-${item.title}-${index}`}
                  item={item}
                  runtimeFamily={runtimeFamily}
                />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export function ReportView({
  run,
  deliveryVersion,
  mode = "teacher",
}: ReportViewProps): JSX.Element {
  const report: BuilderReportEntity = run.report ?? {};
  const [techOpen, setTechOpen] = useState(mode === "teacher");
  const [activeTab, setActiveTab] = useState<"overview" | "coaching" | "technical" | "logs">("overview");
  const [logs, setLogs] = useState<string>("");
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [printOpen, setPrintOpen] = useState<boolean>(false);

  useEffect(() => {
    if (report.readableText) {
      setLogs(report.readableText);
      return;
    }

    let active = true;
    async function fetchLogs() {
      setLoadingLogs(true);
      try {
        let allEvents: any[] = [];
        let afterSequence = 0;
        let hasMore = true;

        while (hasMore && active) {
          const response = await builderApi.listEvents({
            buildRunId: run.id,
            afterSequence,
            limit: 500,
          });

          allEvents = [...allEvents, ...response.events];
          afterSequence = response.latestSequence;
          hasMore = response.hasMore && response.events.length > 0;
        }

        if (!active) return;

        const reconstructed = allEvents
          .filter((event) => event.eventType === "LOG_CHUNK")
          .map((event) =>
            typeof event.payload?.text === "string" ? event.payload.text : ""
          )
          .filter(Boolean)
          .join("");

        setLogs(reconstructed);
      } catch (err) {
        console.error("Error loading execution logs:", err);
      } finally {
        if (active) {
          setLoadingLogs(false);
        }
      }
    }

    void fetchLogs();

    return () => {
      active = false;
    };
  }, [run.id, report.readableText]);

  const coaching = report.coaching ?? null;
  const runtimeFamily = run.llmAssessment?.runtime?.family;
  const techFeedback = report.technicalFeedback ?? {
    security: [],
    architecture: [],
    quality: [],
    rubricCompliance: [],
  };
  const preflight = run.preflightSummary ?? null;
  const primarySummary =
    mode === "student"
      ? run.llmAssessment?.studentSummary
      : run.llmAssessment?.teacherSummary;
  const secondarySummary =
    mode === "student"
      ? null
      : run.llmAssessment?.studentSummary;
  const hasFeedback =
    techFeedback.security.length > 0 ||
    techFeedback.architecture.length > 0 ||
    techFeedback.quality.length > 0 ||
    techFeedback.rubricCompliance.length > 0;
  const selfHealing = report.selfHealing;

  const tabs = [
    { id: "overview", label: "Resumen y Notas", icon: RiDashboardLine },
    { id: "coaching", label: "Plan de Acción", icon: RiFileList3Line },
    { id: "technical", label: "Feedback Técnico", icon: RiCodeSSlashLine },
    { id: "logs", label: "Logs de Ejecución", icon: RiTerminalBoxLine },
  ] as const;

  return (
    <div className="space-y-6">
      <ReportHeader run={run} deliveryVersion={deliveryVersion} mode={mode} />

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between border-b border-app-border gap-1">
        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold uppercase tracking-wider transition-all duration-200 border-b-2 -mb-[2px] ${
                  isActive
                    ? "border-primary text-primary font-bold"
                    : "border-transparent text-slate-400 hover:text-slate-900 hover:border-app-border"
                }`}
              >
                <TabIcon className="text-base" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        {report.printableMarkdown ? (
          <button
            type="button"
            onClick={() => setPrintOpen(true)}
            className="flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-primary transition-colors"
          >
            <RiPrinterLine className="text-base" />
            <span className="hidden sm:inline">Vista de impresión</span>
          </button>
        ) : null}
      </div>

      {/* Tab Panels */}
      <div className="space-y-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {mode === "student" && report.pedagogicalNarrative?.length ? (
              <PedagogicalReport
                items={report.pedagogicalNarrative}
                learningObjective={report.learningObjective}
              />
            ) : null}

            {mode === "teacher" && report.teacherHighlights ? (
              <TeacherHighlights highlights={report.teacherHighlights} />
            ) : null}

            {primarySummary && !(
              (mode === "student" && report.pedagogicalNarrative?.length) ||
              (mode === "teacher" && report.teacherHighlights)
            ) ? (
              <ReportCard
                tone="default"
                title={mode === "student" ? "Resumen pedagógico" : "Resumen docente"}
                description={
                  mode === "student"
                    ? "Qué significa este resultado para tu aprendizaje"
                    : "Lectura curada para consolidar la revisión"
                }
              >
                {run.llmAssessment?.evaluativeState ? (
                  <div className="mb-4">
                    <span className="inline-flex rounded-full border border-app-border bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                      <GlossaryTerm term={run.llmAssessment.evaluativeState}>
                        {run.llmAssessment.evaluativeState}
                      </GlossaryTerm>
                    </span>
                  </div>
                ) : null}
                <div className="text-slate-500">
                  <MarkdownContent content={primarySummary} />
                </div>
                {secondarySummary ? (
                  <details className="mt-5 rounded-xl border border-app-border bg-white px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">
                      {mode === "student"
                        ? "Ver lectura para profesorado"
                        : "Ver lectura pensada para el alumno"}
                    </summary>
                    <div className="mt-3 text-slate-500">
                      <MarkdownContent content={secondarySummary} />
                    </div>
                  </details>
                ) : null}
              </ReportCard>
            ) : null}

            {run.llmAssessment?.gradeBreakdown?.length ? (
              <GradeBreakdownChart items={run.llmAssessment.gradeBreakdown} />
            ) : null}

            {mode === "teacher" && run.llmAssessment ? (
              <ReportCard tone="default" title="Resumen del run">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Tipo", value: run.llmAssessment.structuralType },
                    {
                      label: "Estado evaluativo",
                      value: run.llmAssessment.evaluativeState,
                    },
                    { label: "Confianza", value: run.llmAssessment.confidence },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-app-border bg-slate-50 p-4"
                    >
                      <span className="text-xs uppercase tracking-wider text-slate-400">
                        {item.label}
                      </span>
                      <div className="mt-1 font-semibold text-slate-900">
                        {item.value ? (
                          item.label === "Tipo" ||
                            item.label === "Estado evaluativo" ? (
                            <GlossaryTerm term={item.value}>{item.value}</GlossaryTerm>
                          ) : (
                            item.value
                          )
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {run.llmAssessment.rationale ? (
                  <div className="mt-5 rounded-xl border border-app-border bg-slate-50 p-4 text-slate-500">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Rationale
                    </p>
                    <div className="mt-3">
                      <MarkdownContent content={run.llmAssessment.rationale} />
                    </div>
                  </div>
                ) : null}
                {secondarySummary ? (
                  <details className="mt-5 rounded-xl border border-app-border bg-white px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">
                      Ver lectura pensada para el alumno
                    </summary>
                    <div className="mt-3 text-slate-500">
                      <MarkdownContent content={secondarySummary} />
                    </div>
                  </details>
                ) : null}
              </ReportCard>
            ) : null}

            <TutorChatBlock buildRunId={run.id} report={run.report} />
          </div>
        )}

        {activeTab === "coaching" && (
          <div className="space-y-6">
            {coaching ? (
              <CoachingSummary
                coaching={coaching}
                mode={mode}
                rubricItems={techFeedback.rubricCompliance}
                runtimeFamily={runtimeFamily}
              />
            ) : null}

            {!coaching && report.llmRecommendations?.length ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
                <div className="mb-4 flex items-center gap-2 text-primary-hover">
                  <RiLightbulbFlashLine className="text-xl" aria-hidden="true" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider">
                    {mode === "student"
                      ? "Siguiente paso recomendado"
                      : "Recomendaciones"}
                  </h3>
                </div>
                <ul className="space-y-3 text-sm leading-relaxed text-primary-hover">
                  {report.llmRecommendations.map((recommendation, index) => (
                    <li
                      key={`${recommendation}-${index}`}
                      className="rounded-xl border border-primary/10 bg-white p-3"
                    >
                      <MarkdownContent content={recommendation} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {mode === "teacher" && selfHealing ? (
              <div className="rounded-xl border border-app-border bg-white p-6">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  Autocorrección aplicada
                </h3>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${selfHealing.recovered
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                  >
                    {selfHealing.recovered
                      ? "Recuperado"
                      : selfHealing.attempted
                        ? "Intentado"
                        : "No necesario"}
                  </span>
                  <span className="text-sm text-slate-400">
                    {selfHealing.attemptsUsed} intento
                    {selfHealing.attemptsUsed === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  {selfHealing.summary}
                </p>
              </div>
            ) : null}
          </div>
        )}

        {activeTab === "technical" && (
          <div className="space-y-6">
            {hasFeedback ? (
              <div className="rounded-xl border border-app-border bg-white p-6">
                {mode === "student" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setTechOpen((current) => !current)}
                      className="flex w-full items-center justify-between text-left"
                      aria-expanded={techOpen}
                    >
                      <div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">
                          Puntos de mejora detectados
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Despliega las pestañas para profundizar en la revisión de tu código fuente.
                        </p>
                      </div>
                      <span
                        className={`text-xl text-slate-400 transition-transform ${techOpen ? "rotate-180" : ""}`}
                      >
                        ▼
                      </span>
                    </button>
                    {techOpen ? (
                      <div>
                        <FeedbackAxis
                          title="Seguridad"
                          items={techFeedback.security}
                          runtimeFamily={runtimeFamily}
                        />
                        <FeedbackAxis
                          title="Arquitectura"
                          items={techFeedback.architecture}
                          runtimeFamily={runtimeFamily}
                        />
                        <FeedbackAxis
                          title="Calidad y Estilo"
                          items={techFeedback.quality}
                          runtimeFamily={runtimeFamily}
                        />
                        <FeedbackAxis
                          title="Cumplimiento de rubrica"
                          items={techFeedback.rubricCompliance}
                          runtimeFamily={runtimeFamily}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h3 className="mb-1 text-lg font-bold tracking-tight text-slate-900">
                      Feedback técnico
                    </h3>
                    <FeedbackAxis
                      title="Seguridad"
                      items={techFeedback.security}
                      runtimeFamily={runtimeFamily}
                    />
                    <FeedbackAxis
                      title="Arquitectura"
                      items={techFeedback.architecture}
                      runtimeFamily={runtimeFamily}
                    />
                    <FeedbackAxis
                      title="Calidad"
                      items={techFeedback.quality}
                      runtimeFamily={runtimeFamily}
                    />
                    <FeedbackAxis
                      title="Rúbrica"
                      items={techFeedback.rubricCompliance}
                      runtimeFamily={runtimeFamily}
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border border-dashed border-app-border text-center">
                <RiShieldCheckLine className="text-4xl text-emerald-500 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-500">
                  No se han registrado incidencias ni feedback técnico detallado para este run.
                </p>
              </div>
            )}

            {run.llmAssessment ? (
              <AssessmentContextSummary llmAssessment={run.llmAssessment} mode={mode} />
            ) : null}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="space-y-6">
            {preflight ? <PreflightSummaryBlock preflight={preflight} /> : null}

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border border-dashed border-app-border text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-3"></div>
                <p className="text-sm font-medium text-slate-500">
                  Cargando logs de ejecución...
                </p>
              </div>
            ) : logs ? (
              <div className="rounded-xl border border-app-border bg-white p-6">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
                  {mode === "student"
                    ? "Comentarios adicionales y logs"
                    : "Informe de compilación y pruebas"}
                </h3>
                <TerminalViewer
                  content={logs}
                  title="docker-runner build logs"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-xl border border-dashed border-app-border text-center">
                <RiTerminalBoxLine className="text-4xl text-slate-400 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-500">
                  No hay logs de compilación registrados para esta ejecución.
                </p>
              </div>
            )}

            {run.warnings?.length ? (
              <details className="group rounded-xl border border-app-border bg-white" open={mode === "teacher"}>
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-900">
                  <RiInformationLine className="text-slate-400 group-hover:text-primary" aria-hidden="true" />
                  {mode === "student"
                    ? "Ver registros técnicos del pipeline (avanzado)"
                    : `Avisos del pipeline (${run.warnings.length})`}
                </summary>
                <div className="border-t border-app-border bg-slate-50 p-4 text-xs font-mono text-slate-500">
                  <ul className="list-disc space-y-2 pl-4">
                    {run.warnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </div>
        )}
      </div>

      {printOpen && report.printableMarkdown ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-app-border bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-app-border px-6 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Informe imprimible
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(report.printableMarkdown ?? "");
                  }}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
                >
                  Copiar Markdown
                </button>
                <button
                  type="button"
                  onClick={() => setPrintOpen(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Cerrar"
                >
                  <RiCloseLine className="text-xl" />
                </button>
              </div>
            </div>
            <div className="overflow-auto p-6">
              <div className="prose prose-slate max-w-none">
                <MarkdownContent content={report.printableMarkdown ?? ""} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
