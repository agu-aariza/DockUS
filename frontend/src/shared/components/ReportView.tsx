import { useState } from "react";
import type {
  BuilderPreflightSummary,
  BuilderReportEntity,
  BuilderRuntimeFamily,
  BuildRunEntity,
  TechnicalFeedbackItem,
} from "../types";
import {
  RiAlarmWarningLine,
  RiAlertLine,
  RiCheckLine,
  RiCloseLine,
  RiCodeSSlashLine,
  RiInformationLine,
  RiLightbulbFlashLine,
  RiQuestionLine,
  RiShieldCheckLine,
  RiSparklingLine,
} from "react-icons/ri";

import { AssessmentContextSummary } from "./AssessmentContextSummary";
import { CodeSnippet } from "./CodeSnippet";
import { CoachingSummary } from "./CoachingSummary";
import { GlossaryTerm } from "./Glossary";
import { GradeBreakdownChart } from "./GradeBreakdownChart";
import { MarkdownContent } from "./MarkdownContent";
import { TerminalViewer } from "./TerminalViewer";
import { normalizeTechnicalFeedbackItem } from "../utils/technicalFeedback";

interface ReportViewProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
  mode?: "student" | "teacher";
}

const OUTCOME_CONFIG = {
  PASS: {
    label: "Apto",
    icon: RiCheckLine,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    meaning:
      "Tu entrega cumple con los requisitos esenciales evaluados.",
  },
  FAIL: {
    label: "No apto",
    icon: RiCloseLine,
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    meaning:
      "La entrega sigue bloqueada o no pudo validarse como aprobada.",
  },
  PARTIAL: {
    label: "Necesita mejoras",
    icon: RiAlertLine,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    meaning:
      "Hay evidencia positiva, pero todavia quedan correcciones importantes.",
  },
  UNKNOWN: {
    label: "Sin evaluar",
    icon: RiQuestionLine,
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    meaning:
      "El sistema no pudo producir un resultado concluyente para esta version.",
  },
} as const;

const SEVERITY_STYLE = {
  high: {
    label: "Severidad alta",
    badge: "border-rose-200 bg-rose-50 text-rose-700",
    icon: RiAlarmWarningLine,
  },
  medium: {
    label: "Severidad media",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    icon: RiInformationLine,
  },
  low: {
    label: "Severidad baja",
    badge: "border-sky-200 bg-sky-50 text-sky-700",
    icon: RiLightbulbFlashLine,
  },
} as const;

const AXIS_ICON: Record<string, typeof RiShieldCheckLine> = {
  Seguridad: RiShieldCheckLine,
  Arquitectura: RiCodeSSlashLine,
  Calidad: RiSparklingLine,
  "Calidad y Estilo": RiSparklingLine,
  "Cumplimiento de rubrica": RiInformationLine,
  Rubrica: RiInformationLine,
};

const PREFLIGHT_COMPATIBILITY_LABEL: Record<string, string> = {
  SUPPORTED_AUTO: "soportado automaticamente",
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
  const tone =
    preflight.compatibility === "SUPPORTED_AUTO" ||
    preflight.compatibility === "SUPPORTED_WITH_MANIFEST"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : preflight.compatibility === "PARTIAL"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <section className={`rounded-3xl border p-6 ${tone}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
            Preflight Python-first
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight">
            {PREFLIGHT_PROJECT_TYPE_LABEL[preflight.supportedProjectType] ??
              preflight.supportedProjectType}
          </h3>
          <p className="mt-2 text-sm opacity-90">
            {PREFLIGHT_COMPATIBILITY_LABEL[preflight.compatibility] ??
              preflight.compatibility}{" "}
            · perfil {preflight.executionProfile} · gestor{" "}
            {preflight.dependencyManager}
          </p>
        </div>
        <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em]">
          {preflight.manifestSource === "DOCKUS_MANIFEST"
            ? `Manifest ${preflight.manifestPath ?? "dockus.yml"}`
            : preflight.entrypointCandidates.length > 0
              ? `${preflight.entrypointCandidates.length} entrypoint(s)`
              : "Sin entrypoint claro"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl bg-white/70 p-4 text-sm">
          <div className="font-semibold">Senales detectadas</div>
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
              <li>Motivo tecnico: {preflight.failureCode}</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-2xl bg-white/70 p-4 text-sm">
          <div className="font-semibold">Plan resuelto</div>
          <ul className="mt-3 space-y-2 break-all">
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
        <div className="rounded-2xl bg-white/70 p-4 text-sm">
          <div className="font-semibold">Findings del preflight</div>
          <div className="mt-3 space-y-2">
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
    </section>
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

  return (
    <div className="mt-6">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
        <AxisIcon className="text-base" />
        {title}
      </h4>
      <div className="space-y-3">
        {normalizedItems.map((item, index) => {
          const severity = SEVERITY_STYLE[item.severity];
          const SeverityIcon = severity.icon;

          return (
            <article
              key={`${title}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <span className="font-semibold text-slate-900">{item.title}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${severity.badge}`}
                  >
                    <SeverityIcon className="text-sm" aria-hidden="true" />
                    {severity.label}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {item.level}
                  </span>
                </div>
              </div>

              <div className="mt-2 text-slate-700">
                <MarkdownContent content={item.detail} />
              </div>

              {item.file ? (
                <div className="mt-2 inline-block rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500">
                  {item.file}
                  {item.line ? `:${item.line}` : ""}
                </div>
              ) : null}

              <CodeSnippet code={item.codeSnippet} runtimeFamily={runtimeFamily} />

              {item.conceptExplanation.trim() ? (
                <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                    Aprende mas
                  </summary>
                  <div className="mt-3 text-slate-700">
                    <MarkdownContent content={item.conceptExplanation} />
                  </div>
                </details>
              ) : null}
            </article>
          );
        })}
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

  const outcome =
    report.overallOutcome ??
    (run.status === "SUCCESS"
      ? "PASS"
      : run.status === "FAILED"
        ? "FAIL"
        : "UNKNOWN");

  const config = OUTCOME_CONFIG[outcome] ?? OUTCOME_CONFIG.UNKNOWN;
  const Icon = config.icon;
  const finishedAt = run.finishedAt
    ? new Date(run.finishedAt).toLocaleString("es-ES")
    : "—";
  const selfHealing = report.selfHealing;
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
  const observedEvidenceCount = run.llmAssessment?.observedEvidence?.length ?? 0;
  const evaluationLimitsCount = run.llmAssessment?.evaluationLimits?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className={`rounded-3xl border ${config.border} ${config.bg} p-6`}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.text}`}
          >
            <Icon className="text-3xl" />
          </div>
          <div>
            <div className={`text-xs font-bold uppercase tracking-widest ${config.text}`}>
              Resultado final
            </div>
            <h3 className={`mt-1 text-3xl font-bold tracking-tight ${config.text}`}>
              <GlossaryTerm term={config.label}>{config.label}</GlossaryTerm>
            </h3>
            <p className={`mt-1 text-sm ${config.text} opacity-80`}>
              {deliveryVersion ? `Entrega v${deliveryVersion} · ` : ""}
              {finishedAt}
              {run.failureReason ? ` · ${run.failureReason}` : ""}
            </p>
            {mode === "student" ? (
              <p className={`mt-2 text-sm font-medium ${config.text} opacity-90`}>
                {config.meaning}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {mode === "student" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lectura guiada del informe
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                Empieza por el plan de accion y usa la evidencia como respaldo
              </h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Primero veras coaching, rubric compliance y el resumen curado del
                sistema. Mas abajo quedan los detalles tecnicos y los logs.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
              Informe listo para revisar
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Remediacion
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {coaching
                  ? coaching.passReadiness === "BLOCKED"
                    ? "Hay correcciones obligatorias antes de pasar"
                    : "La practica ya supera lo esencial"
                  : "Consulta el resultado general y las observaciones"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {coaching
                  ? `${coaching.mustFix.length} must-fix · ${coaching.shouldImprove.length} mejora(s) · ${coaching.nextAttemptChecklist.length} paso(s) sugeridos`
                  : "El informe tecnico se resume debajo en coaching, evidencia y feedback estructurado."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Evidencia observada
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {observedEvidenceCount > 0
                  ? `${observedEvidenceCount} evidencia(s) curada(s)`
                  : "Sin evidencia curada destacada"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {evaluationLimitsCount > 0
                  ? `${evaluationLimitsCount} limite(s) de evaluacion explicados.`
                  : "No hay limites destacados en el resumen curado de esta ejecucion."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Lectura recomendada
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                1. Coaching · 2. Rubrica · 3. Logs
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Si vas a reenviar, empieza por el checklist. Si tienes dudas
                tecnicas, baja despues a la evidencia y al log del build.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {preflight ? <PreflightSummaryBlock preflight={preflight} /> : null}

      {primarySummary ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {mode === "student" ? "Resumen pedagogico" : "Resumen docente"}
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                {mode === "student"
                  ? "Que significa este resultado para tu siguiente version"
                  : "Lectura curada para consolidar la revision"}
              </h3>
            </div>
            {run.llmAssessment?.evaluativeState ? (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                <GlossaryTerm term={run.llmAssessment.evaluativeState}>
                  {run.llmAssessment.evaluativeState}
                </GlossaryTerm>
              </span>
            ) : null}
          </div>
          <div className="mt-5 text-slate-700">
            <MarkdownContent content={primarySummary} />
          </div>
          {secondarySummary ? (
            <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                {mode === "student"
                  ? "Ver lectura para profesorado"
                  : "Ver lectura pensada para el alumno"}
              </summary>
              <div className="mt-3 text-slate-700">
                <MarkdownContent content={secondarySummary} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {run.llmAssessment?.gradeBreakdown?.length ? (
        <GradeBreakdownChart items={run.llmAssessment.gradeBreakdown} />
      ) : null}

      {mode === "teacher" && run.llmAssessment ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Resumen del run
          </h3>
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
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <span className="text-xs uppercase tracking-wider text-slate-500">
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
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Rationale
              </p>
              <div className="mt-3">
                <MarkdownContent content={run.llmAssessment.rationale} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "teacher" && selfHealing ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            Autocorreccion aplicada
          </h3>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selfHealing.recovered
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
            <span className="text-sm text-slate-500">
              {selfHealing.attemptsUsed} intento
              {selfHealing.attemptsUsed === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            {selfHealing.summary}
          </p>
        </div>
      ) : null}

      {coaching ? (
        <CoachingSummary
          coaching={coaching}
          mode={mode}
          rubricItems={techFeedback.rubricCompliance}
          runtimeFamily={runtimeFamily}
        />
      ) : null}

      {!coaching && report.llmRecommendations?.length ? (
        <div className="rounded-3xl border border-brand-blue/20 bg-brand-blue/5 p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-brand-blue-dark">
            <RiLightbulbFlashLine className="text-xl" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]">
              {mode === "student"
                ? "Siguiente paso recomendado"
                : "Recomendaciones"}
            </h3>
          </div>
          <ul className="space-y-3 text-sm leading-relaxed text-brand-blue-dark">
            {report.llmRecommendations.map((recommendation, index) => (
              <li
                key={`${recommendation}-${index}`}
                className="rounded-xl border border-brand-blue/10 bg-white/50 p-3"
              >
                <MarkdownContent content={recommendation} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {run.llmAssessment ? (
        <AssessmentContextSummary llmAssessment={run.llmAssessment} mode={mode} />
      ) : null}

      {hasFeedback ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                    Revisa estos apartados antes de preparar la siguiente version.
                  </p>
                </div>
                <span
                  className={`text-xl text-slate-400 transition-transform ${techOpen ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>
              {techOpen ? (
                <div className="animate-in fade-in">
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
                Feedback tecnico
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
      ) : null}

      {report.readableText ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
            {mode === "student"
              ? "Comentarios adicionales y logs"
              : "Informe de compilacion y pruebas"}
          </h3>
          <TerminalViewer
            content={report.readableText}
            title="docker-runner build logs"
          />
        </div>
      ) : null}

      {run.warnings?.length ? (
        <details className="group rounded-2xl border border-slate-200 bg-white" open={mode === "teacher"}>
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-900">
            <RiInformationLine className="text-slate-400 group-hover:text-brand-blue" />
            {mode === "student"
              ? "Ver registros tecnicos del pipeline (avanzado)"
              : `Avisos del pipeline (${run.warnings.length})`}
          </summary>
          <div className="border-t border-slate-100 bg-slate-50 p-4 text-xs font-mono text-slate-600">
            <ul className="list-disc space-y-2 pl-4">
              {run.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </div>
  );
}
