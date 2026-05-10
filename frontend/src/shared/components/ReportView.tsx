import { useState } from "react";
import type {
  BuilderPreflightSummary,
  BuilderReportEntity,
  BuildRunEntity,
  TechnicalFeedbackItem,
} from "../types";
import {
  RiCheckLine,
  RiCloseLine,
  RiAlertLine,
  RiQuestionLine,
  RiLightbulbFlashLine,
  RiInformationLine,
  RiShieldCheckLine,
  RiCodeSSlashLine,
  RiSparklingLine,
} from "react-icons/ri";
import { AssessmentContextSummary } from "./AssessmentContextSummary";
import { CoachingSummary } from "./CoachingSummary";
import { TerminalViewer } from "./TerminalViewer";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ReportViewProps {
  run: BuildRunEntity;
  deliveryVersion?: number;
  /**
   * "student" — vista pedagógica: banner con significado, recomendaciones destacadas,
   *             detalles técnicos plegables.
   * "teacher" — vista completa: resumen del run, self-healing, feedback con severidades,
   *             avisos del pipeline abiertos, texto legible.
   */
  mode?: "student" | "teacher";
}

/* ------------------------------------------------------------------ */
/*  Outcome config                                                     */
/* ------------------------------------------------------------------ */

const OUTCOME_CONFIG = {
  PASS: {
    label: "Apto",
    icon: RiCheckLine,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    meaning:
      "Tu entrega cumple con todos los requisitos evaluados. ¡Buen trabajo!",
  },
  FAIL: {
    label: "No Apto",
    icon: RiCloseLine,
    bg: "bg-rose-50",
    border: "border-rose-200",
    text: "text-rose-700",
    meaning:
      "La entrega no supera los requisitos mínimos o contiene errores graves que impiden su validación.",
  },
  PARTIAL: {
    label: "Necesita mejoras",
    icon: RiAlertLine,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    meaning:
      "Tu código funciona parcialmente, pero hemos detectado problemas que debes corregir.",
  },
  UNKNOWN: {
    label: "Sin evaluar",
    icon: RiQuestionLine,
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-700",
    meaning:
      "El sistema no pudo determinar el resultado final. Consulta con tu profesor.",
  },
} as const;

const SEVERITY_STYLE: Record<string, { badge: string; label: string }> = {
  high: {
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    label: "Alta",
  },
  medium: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    label: "Media",
  },
  low: {
    badge: "bg-sky-100 text-sky-700 border-sky-200",
    label: "Baja",
  },
};

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
  MODULE_CLI: "CLI por módulo",
  WEB_ASGI: "Servicio ASGI",
  WEB_WSGI: "Servicio WSGI",
  DJANGO_SERVICE: "Servicio Django",
  BATCH_WORKER: "Worker batch",
  PYPROJECT_GENERIC: "Proyecto pyproject genérico",
  CUSTOM_MANIFEST: "Contrato custom",
  UNKNOWN: "Tipo sin resolver",
};

function PreflightSummaryBlock({
  preflight,
}: {
  preflight: BuilderPreflightSummary;
}) {
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
            · perfil {preflight.executionProfile} · gestor {preflight.dependencyManager}
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
          <div className="font-semibold">Señales detectadas</div>
          <ul className="mt-3 space-y-2">
            <li>Tests detectados: {preflight.testsPresent ? "sí" : "no"}</li>
            <li>Working dir: {preflight.workingDirectory}</li>
            <li>
              Entrypoints:{" "}
              {preflight.entrypointCandidates.length > 0
                ? preflight.entrypointCandidates.join(", ")
                : "sin candidatos claros"}
            </li>
            <li>Framework: {preflight.detectedFramework ?? "sin framework claro"}</li>
            {preflight.failureCode ? <li>Motivo técnico: {preflight.failureCode}</li> : null}
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
                ? preflight.resolvedCommands.install.map((command) => command.join(" ")).join(" · ")
                : "sin instalación"}
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
                  <span className="font-semibold">{finding.code}</span>: {finding.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function FeedbackAxis({
  title,
  items,
}: {
  title: string;
  items: TechnicalFeedbackItem[];
}) {
  if (items.length === 0) return null;
  const AxisIcon = AXIS_ICON[title] ?? RiInformationLine;

  return (
    <div className="mt-6">
      <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-3">
        <AxisIcon className="text-base" />
        {title}
      </h4>
      <div className="space-y-3">
        {items.map((item, i) => {
          const sev = SEVERITY_STYLE[item.severity];
          return (
            <div
              key={`${title}-${i}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="font-semibold text-slate-900">
                  {item.title}
                </span>
                {sev && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sev.badge}`}
                  >
                    {sev.label}
                  </span>
                )}
              </div>
              <p className="text-slate-600 leading-relaxed">{item.detail}</p>
              {item.file && (
                <div className="mt-2 text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 inline-block rounded">
                  {item.file}
                  {item.line ? `:${item.line}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

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

  const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.UNKNOWN;
  const Icon = config.icon;
  const finishedAt = run.finishedAt
    ? new Date(run.finishedAt).toLocaleString("es-ES")
    : "—";

  const selfHealing = report.selfHealing;
  const coaching = report.coaching ?? null;
  const techFeedback = report.technicalFeedback ?? {
    security: [],
    architecture: [],
    quality: [],
    rubricCompliance: [],
  };
  const preflight = run.preflightSummary ?? null;
  const hasFeedback =
    techFeedback.security.length > 0 ||
    techFeedback.architecture.length > 0 ||
    techFeedback.quality.length > 0 ||
    techFeedback.rubricCompliance.length > 0;
  const observedEvidenceCount =
    run.llmAssessment?.observedEvidence?.length ?? 0;
  const evaluationLimitsCount =
    run.llmAssessment?.evaluationLimits?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── Banner de Resultado ──────────────────────────────── */}
      <div className={`rounded-3xl border ${config.border} ${config.bg} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ${config.text}`}
          >
            <Icon className="text-3xl" />
          </div>
          <div>
            <div
              className={`text-xs font-bold uppercase tracking-widest ${config.text}`}
            >
              Resultado Final
            </div>
            <h3
              className={`mt-1 text-3xl font-bold tracking-tight ${config.text}`}
            >
              {config.label}
            </h3>
            <p className={`mt-1 text-sm ${config.text} opacity-80`}>
              {deliveryVersion ? `Entrega v${deliveryVersion} · ` : ""}
              {finishedAt}
              {run.failureReason ? ` · ${run.failureReason}` : ""}
            </p>
            {mode === "student" && (
              <p
                className={`mt-2 text-sm font-medium ${config.text} opacity-90`}
              >
                {config.meaning}
              </p>
            )}
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
                En esta vista el foco esta en ayudarte a decidir la siguiente
                version: primero veras bloqueos, mejoras y checklist, y debajo
                quedaran la evidencia curada y los detalles tecnicos del run.
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
                  ? `${evaluationLimitsCount} limite(s) de evaluacion explicados para que sepas que no pudo concluir el sistema.`
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

      {/* ─── Resumen del Run (solo teacher) ───────────────────── */}
      {mode === "teacher" && run.llmAssessment && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-4">
            Resumen del Run
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
                className="rounded-xl bg-slate-50 border border-slate-100 p-4"
              >
                <span className="text-xs text-slate-500 uppercase tracking-wider">
                  {item.label}
                </span>
                <div className="mt-1 font-semibold text-slate-900">
                  {item.value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Self-Healing (solo teacher) ──────────────────────── */}
      {mode === "teacher" && selfHealing && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-4">
            Autocorrección aplicada
          </h3>
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                selfHealing.recovered
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-amber-50 border-amber-200 text-amber-700"
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
          <p className="text-sm text-slate-600 leading-relaxed">
            {selfHealing.summary}
          </p>
        </div>
      )}

      {/* ─── Recomendaciones LLM ──────────────────────────────── */}
      {coaching ? (
        <CoachingSummary
          coaching={coaching}
          mode={mode}
          rubricItems={techFeedback.rubricCompliance}
        />
      ) : null}

      {!coaching &&
        report.llmRecommendations &&
        report.llmRecommendations.length > 0 && (
        <div className="rounded-3xl border-brand-blue/20 bg-brand-blue/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-brand-blue-dark">
            <RiLightbulbFlashLine className="text-xl" />
            <h3 className="text-sm font-bold uppercase tracking-[0.16em]">
              {mode === "student"
                ? "Siguiente paso recomendado"
                : "Recomendaciones"}
            </h3>
          </div>
          <ul className="space-y-3 text-sm text-brand-blue-dark leading-relaxed">
            {report.llmRecommendations.map((rec, i) => (
              <li
                key={i}
                className="flex gap-3 bg-white/50 p-3 rounded-xl border border-brand-blue/10"
              >
                <span className="text-brand-blue/40 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.llmAssessment ? (
        <AssessmentContextSummary llmAssessment={run.llmAssessment} mode={mode} />
      ) : null}

      {/* ─── Feedback Técnico ─────────────────────────────────── */}
      {hasFeedback && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "student" ? (
            <>
              <button
                onClick={() => setTechOpen(!techOpen)}
                className="w-full flex items-center justify-between text-left"
              >
                <div>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">
                    Puntos de mejora detectados
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Revisa estos apartados en tu código antes de enviar la
                    siguiente versión.
                  </p>
                </div>
                <span
                  className={`text-slate-400 text-xl transition-transform ${techOpen ? "rotate-180" : ""}`}
                >
                  ▼
                </span>
              </button>
              {techOpen && (
                <div className="animate-in fade-in">
                  <FeedbackAxis
                    title="Seguridad"
                    items={techFeedback.security}
                  />
                  <FeedbackAxis
                    title="Arquitectura"
                    items={techFeedback.architecture}
                  />
                  <FeedbackAxis
                    title="Calidad y Estilo"
                    items={techFeedback.quality}
                  />
                  <FeedbackAxis
                    title="Cumplimiento de rubrica"
                    items={techFeedback.rubricCompliance}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold tracking-tight text-slate-900 mb-1">
                Feedback técnico
              </h3>
              <FeedbackAxis title="Seguridad" items={techFeedback.security} />
              <FeedbackAxis
                title="Arquitectura"
                items={techFeedback.architecture}
              />
              <FeedbackAxis title="Calidad" items={techFeedback.quality} />
              {techFeedback.rubricCompliance &&
                techFeedback.rubricCompliance.length > 0 && (
                  <FeedbackAxis
                    title="Rúbrica"
                    items={techFeedback.rubricCompliance}
                  />
                )}
            </>
          )}
        </div>
      )}

      {/* ─── Texto legible (Terminal Viewer) ────────────────────── */}
      {report.readableText && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 mb-2">
            {mode === "student" ? "Comentarios adicionales / Logs" : "Informe de compilación y pruebas"}
          </h3>
          <TerminalViewer content={report.readableText} title="docker-runner build logs" />
        </div>
      )}

      {/* ─── Avisos del pipeline ──────────────────────────────── */}
      {run.warnings && run.warnings.length > 0 && (
        <details
          className="group rounded-2xl border border-slate-200 bg-white"
          open={mode === "teacher"}
        >
          <summary className="cursor-pointer flex items-center gap-2 font-medium text-slate-600 hover:text-slate-900 px-4 py-3 text-sm">
            <RiInformationLine className="text-slate-400 group-hover:text-brand-blue" />
            {mode === "student"
              ? "Ver registros técnicos del pipeline (Avanzado)"
              : `Avisos del pipeline (${run.warnings.length})`}
          </summary>
          <div className="border-t border-slate-100 p-4 bg-slate-50 text-xs text-slate-600 font-mono">
            <ul className="space-y-2 list-disc pl-4">
              {run.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        </details>
      )}
    </div>
  );
}
