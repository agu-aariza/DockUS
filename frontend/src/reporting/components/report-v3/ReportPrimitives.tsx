import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiBarChartGroupedLine,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiCodeSSlashLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiLineChartLine,
  RiListCheck3,
  RiQuestionLine,
  RiRoadMapLine,
  RiShieldCheckLine,
  RiSparklingLine,
} from "react-icons/ri";

import type {
  ReportComparisonView,
  ReportCriterionStatus,
  ReportCriterionView,
  ReportEvidenceView,
  ReportFindingView,
} from "@educodeai/contracts";

type ReportTone = "default" | "primary" | "success" | "warning" | "danger";
type GradeTone = "primary" | "success" | "warning" | "neutral";

const SECTION_TONES: Record<
  ReportTone,
  { card: string; icon: string; eyebrow: string }
> = {
  default: {
    card: "border-app-border bg-app-surface",
    icon: "bg-app-bg-subtle text-app-text-secondary",
    eyebrow: "text-app-text-muted",
  },
  primary: {
    card: "border-primary/20 bg-app-surface",
    icon: "bg-primary-subtle text-primary",
    eyebrow: "text-primary",
  },
  success: {
    card: "border-success/25 bg-app-surface",
    icon: "bg-success-subtle text-success",
    eyebrow: "text-success",
  },
  warning: {
    card: "border-warning/30 bg-app-surface",
    icon: "bg-warning-subtle text-warning",
    eyebrow: "text-warning",
  },
  danger: {
    card: "border-danger/25 bg-app-surface",
    icon: "bg-danger-subtle text-danger",
    eyebrow: "text-danger",
  },
};

function ReportSection({
  eyebrow,
  title,
  description,
  icon: Icon,
  tone = "default",
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: IconType;
  tone?: ReportTone;
  action?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const styles = SECTION_TONES[tone];

  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm sm:p-6 ${styles.card}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
          >
            <Icon className="text-xl" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className={`ui-label ${styles.eyebrow}`}>{eyebrow}</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-app-text">
              {title}
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-app-text-secondary">
              {description}
            </p>
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const GRADE_TONES: Record<
  GradeTone,
  { rail: string; badge: string; bar: string }
> = {
  primary: {
    rail: "bg-primary",
    badge: "border-primary/20 bg-primary-subtle text-primary",
    bar: "bg-primary",
  },
  success: {
    rail: "bg-success",
    badge: "border-success/25 bg-success-subtle text-success",
    bar: "bg-success",
  },
  warning: {
    rail: "bg-warning",
    badge: "border-warning/30 bg-warning-subtle text-warning",
    bar: "bg-warning",
  },
  neutral: {
    rail: "bg-app-text-muted/50",
    badge: "border-app-border bg-app-bg-subtle text-app-text-secondary",
    bar: "bg-app-text-muted",
  },
};

export function ReportGrade({
  label,
  value,
  badge,
  tone = "primary",
}: {
  label: string;
  value: number | null;
  badge: string;
  tone?: GradeTone;
}): JSX.Element {
  const styles = GRADE_TONES[tone];
  const percentage =
    value === null ? 0 : Math.max(0, Math.min(100, Math.round(value * 10)));

  return (
    <article className="relative overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm">
      <span
        className={`absolute inset-y-0 left-0 w-1 ${styles.rail}`}
        aria-hidden="true"
      />
      <div className="flex items-center justify-between gap-3 pl-2">
        <span className="ui-label">{label}</span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles.badge}`}
        >
          {badge}
        </span>
      </div>
      <div className="mt-5 flex items-baseline gap-2 pl-2">
        <span className="data-figure text-4xl font-semibold leading-none">
          {value === null ? "—" : value.toFixed(2)}
        </span>
        {value !== null ? (
          <span className="font-mono text-sm text-app-text-muted">/ 10</span>
        ) : null}
      </div>
      <div className="mt-5 pl-2">
        <div className="h-2 overflow-hidden rounded-full bg-app-bg-subtle">
          {value !== null ? (
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${styles.bar}`}
              style={{ width: `${Math.max(5, percentage)}%` }}
            />
          ) : null}
        </div>
        <p className="mt-2 text-xs text-app-text-muted">
          {value === null
            ? "Todavía no hay una calificación disponible."
            : `${percentage}% del máximo de la escala`}
        </p>
      </div>
    </article>
  );
}

const CRITERION_STATUS: Record<
  ReportCriterionStatus,
  { label: string; icon: IconType; tone: string; bar: string }
> = {
  ACHIEVED: {
    label: "Logrado",
    icon: RiCheckboxCircleLine,
    tone: "border-success/25 bg-success-subtle text-success",
    bar: "bg-success",
  },
  PARTIAL: {
    label: "Parcial",
    icon: RiAlertLine,
    tone: "border-warning/30 bg-warning-subtle text-warning",
    bar: "bg-warning",
  },
  NOT_ACHIEVED: {
    label: "Pendiente",
    icon: RiErrorWarningLine,
    tone: "border-danger/25 bg-danger-subtle text-danger",
    bar: "bg-danger",
  },
  NOT_ASSESSED: {
    label: "Sin evaluar",
    icon: RiQuestionLine,
    tone: "border-app-border bg-app-bg-subtle text-app-text-muted",
    bar: "bg-app-text-muted",
  },
};

export function RubricSection({
  criteria,
}: {
  criteria: ReportCriterionView[];
}): JSX.Element {
  const achieved = criteria.filter(
    (criterion) => criterion.status === "ACHIEVED",
  ).length;
  const awarded = criteria.reduce((sum, criterion) => sum + criterion.awarded, 0);
  const maximum = criteria.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0,
  );

  return (
    <ReportSection
      eyebrow="Criterios de evaluación"
      title="Rúbrica explicada"
      description="Consulta qué se ha valorado en cada criterio y cómo se distribuyen los puntos."
      icon={RiListCheck3}
      tone="primary"
      action={
        <span className="status-chip border-primary/20 bg-primary-subtle text-primary">
          {achieved}/{criteria.length} logrados
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-app-border bg-app-bg-subtle/60 px-4 py-3">
        <span className="text-sm text-app-text-secondary">
          Resultado de la rúbrica
        </span>
        <span className="data-figure text-sm font-semibold">
          {awarded.toFixed(2)} / {maximum.toFixed(2)} puntos
        </span>
      </div>

      {criteria.length > 0 ? (
        <div className="space-y-3">
          {criteria.map((criterion) => {
            const config = CRITERION_STATUS[criterion.status];
            const Icon = config.icon;
            const percentage =
              criterion.maxPoints > 0
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      Math.round((criterion.awarded / criterion.maxPoints) * 100),
                    ),
                  )
                : 0;

            return (
              <article
                key={criterion.id}
                className="rounded-xl border border-app-border bg-app-bg-subtle/35 p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.tone}`}
                    >
                      <Icon aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-app-text">
                          {criterion.name}
                        </h4>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.tone}`}
                        >
                          {config.label}
                        </span>
                      </div>
                      {criterion.description ? (
                        <p className="mt-1 text-xs leading-5 text-app-text-muted">
                          {criterion.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="data-figure shrink-0 text-sm font-semibold text-app-text-secondary">
                    {criterion.awarded.toFixed(2)} / {criterion.maxPoints.toFixed(2)}
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-app-bg-subtle">
                  <div
                    className={`h-full rounded-full ${config.bar}`}
                    style={{ width: `${Math.max(percentage > 0 ? 6 : 0, percentage)}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                  {criterion.explanation || "No hay una explicación adicional para este criterio."}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-app-border px-4 py-6 text-center text-sm text-app-text-muted">
          No hay criterios de rúbrica disponibles para esta evaluación.
        </p>
      )}
    </ReportSection>
  );
}

const EVIDENCE_CONFIG: Record<
  ReportEvidenceView["kind"],
  { label: string; icon: IconType; tone: string }
> = {
  execution: {
    label: "Ejecución",
    icon: RiLineChartLine,
    tone: "bg-success-subtle text-success",
  },
  source: {
    label: "Código fuente",
    icon: RiCodeSSlashLine,
    tone: "bg-primary-subtle text-primary",
  },
  rubric: {
    label: "Rúbrica",
    icon: RiListCheck3,
    tone: "bg-warning-subtle text-warning",
  },
  quality: {
    label: "Calidad",
    icon: RiSparklingLine,
    tone: "bg-app-bg-subtle text-app-text-secondary",
  },
};

export function EvidenceSection({
  evidence,
}: {
  evidence: ReportEvidenceView[];
}): JSX.Element | null {
  if (evidence.length === 0) return null;

  return (
    <ReportSection
      eyebrow="Trazabilidad"
      title="Evidencia"
      description="Señales concretas que respaldan el resultado de esta evaluación."
      icon={RiShieldCheckLine}
      tone="success"
      action={
        <span className="status-chip border-success/25 bg-success-subtle text-success">
          {evidence.length} {evidence.length === 1 ? "señal" : "señales"}
        </span>
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {evidence.map((item) => {
          const config = EVIDENCE_CONFIG[item.kind];
          const Icon = config.icon;

          return (
            <article
              key={item.id}
              className="rounded-xl border border-app-border bg-app-bg-subtle/35 p-4"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.tone}`}
                >
                  <Icon aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="ui-label">{config.label}</div>
                  <h4 className="mt-1 font-semibold text-app-text">
                    {item.summary}
                  </h4>
                </div>
              </div>
              {item.detail ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-app-text-secondary">
                  {item.detail}
                </p>
              ) : null}
              {item.file ? (
                <p className="data-meta mt-4">
                  {item.file}
                  {item.line ? `:${item.line}` : ""}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </ReportSection>
  );
}

const SEVERITY_CONFIG: Record<
  ReportFindingView["severity"],
  { label: string; tone: string }
> = {
  high: { label: "Alta", tone: "border-danger/25 bg-danger-subtle text-danger" },
  medium: {
    label: "Media",
    tone: "border-warning/30 bg-warning-subtle text-warning",
  },
  low: {
    label: "Baja",
    tone: "border-primary/20 bg-primary-subtle text-primary",
  },
};

const FINDING_SEVERITY_ORDER: Record<ReportFindingView["severity"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const CATEGORY_LABELS: Record<ReportFindingView["category"], string> = {
  security: "Seguridad",
  architecture: "Arquitectura",
  quality: "Calidad",
  rubricCompliance: "Rúbrica",
  evaluation: "Evaluación",
};

export function FindingsSection({
  title,
  findings,
}: {
  title: string;
  findings: ReportFindingView[];
}): JSX.Element | null {
  if (findings.length === 0) return null;

  const blockingCount = findings.filter((finding) => finding.blocking).length;
  const highSeverityCount = findings.filter(
    (finding) => finding.severity === "high",
  ).length;
  const orderedFindings = findings
    .map((finding, index) => ({ finding, index }))
    .sort(
      (left, right) =>
        Number(right.finding.blocking) - Number(left.finding.blocking) ||
        FINDING_SEVERITY_ORDER[right.finding.severity] -
          FINDING_SEVERITY_ORDER[left.finding.severity] ||
        left.index - right.index,
    )
    .map(({ finding }) => finding);
  const sectionTone = blockingCount > 0 ? "danger" : "warning";
  const routeCopy =
    blockingCount > 0
      ? `Empieza por los ${blockingCount === 1 ? "bloqueo" : "bloqueos"} marcados como prioritarios y vuelve a ejecutar la evaluación.`
      : "No hay bloqueos de entrega. Revisa las señales por orden de impacto para consolidar la siguiente versión.";

  return (
    <ReportSection
      eyebrow="Señales para actuar"
      title={title}
      description={
        blockingCount > 0
          ? "Hay señales que pueden impedir que la entrega avance. Esta lista te indica qué revisar primero."
          : "Las señales están ordenadas por impacto para que puedas convertir la revisión en acciones concretas."
      }
      icon={RiErrorWarningLine}
      tone={sectionTone}
      action={
        <span
          className={`status-chip ${
            blockingCount > 0
              ? "border-danger/25 bg-danger-subtle text-danger"
              : "border-warning/30 bg-warning-subtle text-warning"
          }`}
        >
          {blockingCount > 0
            ? `${blockingCount} ${blockingCount === 1 ? "bloqueo" : "bloqueos"}`
            : `${findings.length} ${findings.length === 1 ? "hallazgo" : "hallazgos"}`}
        </span>
      }
    >
      <div
        className={`rounded-2xl border p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-5 ${
          blockingCount > 0
            ? "border-danger/25 bg-danger-subtle/60"
            : "border-warning/30 bg-warning-subtle/60"
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface ${
              blockingCount > 0 ? "text-danger" : "text-warning"
            }`}
          >
            <RiRoadMapLine className="text-xl" aria-hidden="true" />
          </span>
          <div>
            <p
              className={`ui-label ${
                blockingCount > 0 ? "text-danger" : "text-warning"
              }`}
            >
              Ruta de revisión
            </p>
            <p className="mt-1 text-sm leading-6 text-app-text-secondary">
              {routeCopy}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">
          <span
            className={`status-chip ${
              blockingCount > 0
                ? "border-danger/20 bg-app-surface text-danger"
                : "border-app-border bg-app-surface text-app-text-muted"
            }`}
          >
            {blockingCount} {blockingCount === 1 ? "bloqueo" : "bloqueos"}
          </span>
          <span
            className={`status-chip ${
              highSeverityCount > 0
                ? "border-warning/25 bg-app-surface text-warning"
                : "border-app-border bg-app-surface text-app-text-muted"
            }`}
          >
            {highSeverityCount} {highSeverityCount === 1 ? "señal alta" : "señales altas"}
          </span>
          <span className="status-chip border-primary/20 bg-app-surface text-primary">
            {findings.length} {findings.length === 1 ? "acción" : "acciones"}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {orderedFindings.map((finding, index) => {
          const severity = SEVERITY_CONFIG[finding.severity];
          const accent = finding.blocking
            ? "border-danger/30 border-l-danger"
            : finding.severity === "high"
              ? "border-warning/30 border-l-warning"
              : "border-primary/20 border-l-primary";
          const priorityLabel = finding.blocking
            ? "Resolver antes de entregar"
            : finding.severity === "high"
              ? "Revisar pronto"
              : "Mejora recomendada";

          return (
            <article
              key={finding.id}
              className={`relative overflow-hidden rounded-2xl border border-l-4 bg-app-surface shadow-sm ${accent}`}
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-bg-subtle font-mono text-xs font-bold text-app-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-app-border bg-app-bg-subtle px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-app-text-muted">
                          {CATEGORY_LABELS[finding.category]}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${severity.tone}`}
                        >
                          Severidad {severity.label}
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold tracking-tight text-app-text">
                        {finding.title}
                      </h4>
                      {finding.file ? (
                        <p className="data-meta mt-2">
                          {finding.file}
                          {finding.line ? `:${finding.line}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    <span
                      className={`status-chip ${
                        finding.blocking
                          ? "border-danger/25 bg-danger-subtle text-danger"
                          : "border-app-border bg-app-bg-subtle text-app-text-secondary"
                      }`}
                    >
                      {finding.blocking ? "Bloquea la entrega" : priorityLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-app-border bg-app-bg-subtle/40 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                      <RiInformationLine aria-hidden="true" />
                      Qué se ha observado
                    </div>
                    <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                      {finding.explanation}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/15 bg-primary-subtle/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                      <RiSparklingLine aria-hidden="true" />
                      Siguiente acción
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-app-text-secondary">
                      {finding.recommendation}
                    </p>
                  </div>
                </div>

                {finding.codeSnippet ? (
                  <details className="group mt-4 overflow-hidden rounded-xl border border-app-border bg-app-bg-subtle/40">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-app-text-secondary hover:bg-app-bg-subtle/70">
                      <RiCodeSSlashLine className="text-primary" aria-hidden="true" />
                      <span className="flex-1">Ver fragmento de código</span>
                      <RiArrowDownSLine className="text-lg text-app-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <pre className="overflow-x-auto border-t border-app-border bg-app-bg px-4 py-3 font-mono text-xs leading-5 text-app-text-secondary">
                      <code>{finding.codeSnippet}</code>
                    </pre>
                  </details>
                ) : null}

                {finding.evidenceIds.length > 0 ? (
                  <div className="mt-4 flex items-center gap-2 border-t border-app-border pt-4 text-xs text-app-text-muted">
                    <RiCheckLine className="text-success" aria-hidden="true" />
                    <span>
                      Respaldado por {finding.evidenceIds.length}{" "}
                      {finding.evidenceIds.length === 1 ? "señal de evidencia" : "señales de evidencia"}
                    </span>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </ReportSection>
  );
}

export function ComparisonSection({
  comparison,
}: {
  comparison: ReportComparisonView;
}): JSX.Element | null {
  if (!comparison) return null;

  if ("reason" in comparison) {
    const label =
      comparison.reason === "FIRST_ATTEMPT"
        ? "Es el primer intento comparable."
        : comparison.reason === "LEGACY_REPORT_NOT_COMPARABLE"
          ? "El intento anterior usa el formato histórico y no se compara automáticamente."
          : "No hay un run anterior completado que sirva de referencia.";

    return (
      <div className="flex items-start gap-3 rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-bg-subtle text-app-text-muted">
          <RiInformationLine aria-hidden="true" />
        </span>
        <div>
          <p className="ui-label">Evolución</p>
          <p className="mt-1 text-sm leading-6 text-app-text-secondary">
            {label}
          </p>
        </div>
      </div>
    );
  }

  const groups: Array<{
    label: string;
    items: string[];
    tone: string;
  }> = [
    {
      label: "Mejoran",
      items: comparison.improvedCriteria,
      tone: "border-success/25 bg-success-subtle text-success",
    },
    {
      label: "Empeoran",
      items: comparison.regressedCriteria,
      tone: "border-danger/25 bg-danger-subtle text-danger",
    },
    {
      label: "Bloqueos resueltos",
      items: comparison.resolvedBlockers,
      tone: "border-primary/20 bg-primary-subtle text-primary",
    },
    {
      label: "Bloqueos persistentes",
      items: comparison.persistentBlockers,
      tone: "border-warning/30 bg-warning-subtle text-warning",
    },
    {
      label: "Bloqueos nuevos",
      items: comparison.newBlockers,
      tone: "border-danger/25 bg-danger-subtle text-danger",
    },
  ];

  return (
    <ReportSection
      eyebrow="Comparativa"
      title={`Evolución desde la entrega v${comparison.baselineDeliveryVersion}`}
      description="Una lectura rápida de lo que ha cambiado respecto al intento anterior completado."
      icon={RiBarChartGroupedLine}
      tone="primary"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {groups.map(({ label, items, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-app-border bg-app-bg-subtle/35 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-app-text-muted">
                {label}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
              >
                {items.length}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-app-text-secondary">
              {items.length ? items.join(" · ") : "Sin cambios en este grupo"}
            </p>
          </div>
        ))}
      </div>
    </ReportSection>
  );
}
