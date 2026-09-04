import type { ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  RiAlertLine,
  RiArrowDownSLine,
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiDownload2Line,
  RiFlagLine,
  RiInformationLine,
  RiLineChartLine,
  RiListCheck3,
  RiQuestionLine,
  RiSparklingLine,
} from "react-icons/ri";
import type { TeacherReportView as TeacherReport } from "@educodeai/contracts";

import { Button } from "../../shared/components/ui/Button";
import { OutcomeBadge } from "./report/OutcomeBadge";
import {
  ComparisonSection,
  EvidenceSection,
  FindingsSection,
  ReportGrade,
  RubricSection,
} from "./report-v3/ReportPrimitives";

type InsightTone = "success" | "warning" | "primary";

const INSIGHT_TONES: Record<
  InsightTone,
  { card: string; icon: string; marker: string; eyebrow: string }
> = {
  success: {
    card: "border-success/25",
    icon: "bg-success-subtle text-success",
    marker: "bg-success",
    eyebrow: "text-success",
  },
  warning: {
    card: "border-warning/30",
    icon: "bg-warning-subtle text-warning",
    marker: "bg-warning",
    eyebrow: "text-warning",
  },
  primary: {
    card: "border-primary/20",
    icon: "bg-primary-subtle text-primary",
    marker: "bg-primary",
    eyebrow: "text-primary",
  },
};

function formatReportDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

function InsightCard({
  eyebrow,
  title,
  items,
  icon: Icon,
  tone,
  emptyLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  items: string[];
  icon: IconType;
  tone: InsightTone;
  emptyLabel: string;
  children?: ReactNode;
}): JSX.Element {
  const styles = INSIGHT_TONES[tone];

  return (
    <article className={`rounded-2xl border bg-app-surface p-5 shadow-sm ${styles.card}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
          <Icon className="text-xl" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className={`ui-label ${styles.eyebrow}`}>{eyebrow}</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-app-text">
            {title}
          </h3>
        </div>
      </div>
      {items.length > 0 ? (
        <ul className="mt-5 space-y-3 text-sm leading-6 text-app-text-secondary">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${styles.marker}`} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm leading-6 text-app-text-muted">{emptyLabel}</p>
      )}
      {children}
    </article>
  );
}

export function TeacherReportView({
  report,
  onExport,
  onExportStudent,
  onUseAiGrade,
}: {
  report: TeacherReport;
  onExport: () => void;
  onExportStudent: () => void;
  onUseAiGrade?: (grade: number) => void;
}): JSX.Element {
  const confidenceLabel =
    report.confidence === "high"
      ? "Alta"
      : report.confidence === "medium"
        ? "Media"
        : "Baja";
  const outcomeCopy =
    report.outcome === "PASS"
      ? "La entrega cumple los requisitos esenciales y queda lista para la decisión académica."
      : report.outcome === "FAIL"
        ? "La entrega presenta bloqueos que requieren revisión antes de considerarla superada."
        : report.outcome === "PARTIAL"
          ? "La entrega muestra avances, aunque todavía requiere seguimiento en algunos criterios."
          : "La evaluación no ha producido todavía un resultado concluyente.";
  const deltaLabel =
    report.grade.delta === null
      ? "Sin comparación"
      : `${report.grade.delta >= 0 ? "+" : ""}${report.grade.delta.toFixed(2)} puntos`;

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-app-border bg-app-surface p-5 shadow-sm sm:p-6">
        <span className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <RiListCheck3 className="text-2xl" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ui-label text-primary">
                  Informe docente · entrega v{report.deliveryVersion}
                </p>
                <OutcomeBadge outcome={report.outcome} />
              </div>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">
                {report.narrative.executiveSummary}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-app-text-secondary">
                {outcomeCopy}
              </p>
              <div className="data-meta mt-4 flex flex-wrap gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <RiCalendarLine aria-hidden="true" /> Generado {formatReportDate(report.generatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RiInformationLine aria-hidden="true" /> Confianza {confidenceLabel}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <Button variant="secondary" size="sm" onClick={onExportStudent}>
              <RiDownload2Line aria-hidden="true" />
              Exportar vista alumno
            </Button>
            <Button variant="secondary" size="sm" onClick={onExport}>
              <RiDownload2Line aria-hidden="true" />
              Exportar vista docente
            </Button>
          </div>
        </div>
      </header>

      <section aria-label="Calificaciones" className="grid gap-4 md:grid-cols-2">
        <ReportGrade
          label="Propuesta de la IA"
          value={report.grade.provisional}
          badge="Provisional"
          tone="warning"
        />
        <ReportGrade
          label="Decisión académica"
          value={report.grade.official}
          badge="Oficial"
          tone="success"
        />
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-app-bg-subtle/50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-app-text-secondary">
          <RiLineChartLine className="text-primary" aria-hidden="true" />
          <span>Distancia entre propuesta y decisión académica</span>
        </div>
        <span className="data-figure text-sm font-semibold text-app-text">
          {deltaLabel}
        </span>
      </div>

      {report.grade.provisional !== null && onUseAiGrade ? (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onUseAiGrade(report.grade.provisional as number)}
          >
            <RiCheckboxCircleLine aria-hidden="true" />
            Usar propuesta de la IA
          </Button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <InsightCard
          eyebrow="Lectura positiva"
          title="Fortalezas"
          items={report.narrative.strengths}
          icon={RiSparklingLine}
          tone="success"
          emptyLabel="No se han registrado fortalezas destacadas en esta versión."
        />
        <InsightCard
          eyebrow="Seguimiento"
          title="Preocupaciones y seguimiento"
          items={report.narrative.concerns}
          icon={RiAlertLine}
          tone="warning"
          emptyLabel="No hay preocupaciones prioritarias registradas."
        >
          {report.narrative.followUp.length > 0 ? (
            <div className="mt-5 border-t border-app-border pt-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-warning">
                <RiFlagLine aria-hidden="true" /> Próximo seguimiento
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
                {report.narrative.followUp.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </InsightCard>
      </section>

      <ComparisonSection comparison={report.comparison} />
      <RubricSection criteria={report.rubric} />
      <EvidenceSection evidence={report.evidence} />
      <FindingsSection title="Hallazgos técnicos" findings={report.findings} />

      {report.reviewFlags.length > 0 ? (
        <section className="rounded-2xl border border-warning/30 bg-warning-subtle p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface text-warning">
              <RiFlagLine className="text-xl" aria-hidden="true" />
            </span>
            <div>
              <p className="ui-label text-warning">Control docente</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-app-text">
                Revisión recomendada
              </h3>
              <p className="mt-1 text-sm leading-6 text-app-text-secondary">
                Estas señales ayudan a decidir si conviene revisar manualmente la entrega.
              </p>
            </div>
          </div>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {report.reviewFlags.map((flag) => (
              <li
                key={flag}
                className="flex items-start gap-2 rounded-xl border border-warning/20 bg-app-surface px-4 py-3 text-sm leading-6 text-app-text-secondary"
              >
                <RiAlertLine className="mt-1 shrink-0 text-warning" aria-hidden="true" />
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.narrative.reviewQuestions.length > 0 ? (
        <section className="rounded-2xl border border-primary/20 bg-primary-subtle p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface text-primary">
              <RiQuestionLine className="text-xl" aria-hidden="true" />
            </span>
            <div>
              <p className="ui-label text-primary">Conversación académica</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-app-text">
                Preguntas para la revisión
              </h3>
              <p className="mt-1 text-sm leading-6 text-app-text-secondary">
                Puntos de partida para comentar la entrega con el alumno.
              </p>
            </div>
          </div>
          <ul className="mt-5 space-y-3">
            {report.narrative.reviewQuestions.map((question) => (
              <li
                key={question}
                className="rounded-xl border border-primary/15 bg-app-surface px-4 py-3 text-sm leading-6 text-app-text-secondary"
              >
                {question}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="group overflow-hidden rounded-2xl border border-primary/20 bg-primary-subtle/35 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-primary-subtle/60 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-surface text-primary">
            <RiCheckboxCircleLine className="text-xl" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="ui-label text-primary">Comunicación al alumno</span>
            <span className="mt-1 block text-base font-semibold text-app-text">
              Vista previa exacta del alumno
            </span>
          </span>
          <RiArrowDownSLine className="text-xl text-app-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-primary/15 bg-app-surface/70 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] sm:p-6">
          <div>
            <p className="ui-label text-primary">Resumen que recibirá el alumno</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-app-text">
              {report.studentPreview.narrative.headline}
            </h3>
          </div>
          <div className="rounded-xl border border-primary/15 bg-app-surface p-4">
            <p className="ui-label text-primary">Próximos pasos</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
              {report.studentPreview.narrative.nextSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold text-primary">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </details>

      <details className="group overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-app-bg-subtle/40 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg-subtle text-app-text-secondary">
            <RiInformationLine className="text-xl" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="ui-label">Auditoría del informe</span>
            <span className="mt-1 block text-base font-semibold text-app-text">
              Límites y trazabilidad avanzada
            </span>
          </span>
          <span className="hidden rounded-full border border-app-border bg-app-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-app-text-muted sm:inline-flex">
            {report.limitations.length} {report.limitations.length === 1 ? "límite" : "límites"}
          </span>
          <RiArrowDownSLine className="text-xl text-app-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-4 border-t border-app-border bg-app-bg-subtle/25 p-5 sm:p-6">
          {report.limitations.length > 0 ? (
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <h3 className="font-semibold text-app-text">Límites de la evaluación</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
                {report.limitations.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-text-muted" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-app-border px-4 py-5 text-sm text-app-text-muted">
              No se han registrado límites adicionales para esta evaluación.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <p className="ui-label">Versión de evaluación</p>
              <p className="data-meta mt-2 text-app-text-secondary">
                {report.audit.evaluationSchemaVersion}
              </p>
            </div>
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <p className="ui-label">Copia narrativa</p>
              <p className="data-meta mt-2 text-app-text-secondary">
                {report.audit.reportCopySchemaVersion}
              </p>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
