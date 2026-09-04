import type { IconType } from "react-icons";
import {
  RiArrowDownSLine,
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiDownload2Line,
  RiFlagLine,
  RiInformationLine,
  RiLightbulbFlashLine,
  RiRoadMapLine,
  RiSparklingLine,
} from "react-icons/ri";
import type { StudentReportView as StudentReport } from "@educodeai/contracts";
import { TutorChatBlock } from "../../builder/components/TutorChatBlock";
import { Button } from "../../shared/components/ui/Button";
import { OutcomeBadge } from "./report/OutcomeBadge";
import {
  ComparisonSection,
  EvidenceSection,
  FindingsSection,
  ReportGrade,
  RubricSection,
} from "./report-v3/ReportPrimitives";

export function StudentReportView({
  report,
  onExport,
  buildRunId,
}: {
  report: StudentReport;
  onExport: () => void;
  /** Se pasa desde ReportView para montar el chat dentro del workspace real. */
  buildRunId?: string;
}) {
  const narrativeTone = report.outcome === "FAIL" ? "danger" : "warning";
  const outcomeCopy =
    report.outcome === "PASS"
      ? "Tu entrega cumple los requisitos esenciales evaluados. Ahora puedes consolidar lo aprendido."
      : report.outcome === "FAIL"
        ? "Aún hay bloqueos importantes. El informe te guía para abordarlos paso a paso."
        : report.outcome === "PARTIAL"
          ? "Hay avances claros, pero todavía quedan algunos aspectos que conviene reforzar."
          : "El sistema no ha podido producir un resultado concluyente para esta versión.";
  const generatedAt = new Date(report.generatedAt);
  const generatedLabel = Number.isNaN(generatedAt.getTime())
    ? "Fecha no disponible"
    : generatedAt.toLocaleString("es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
      });

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary-subtle p-5 shadow-sm sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-app-surface/40 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-app-surface text-primary shadow-sm">
              <RiSparklingLine className="text-2xl" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="ui-label text-primary">
                  Informe de aprendizaje · entrega v{report.deliveryVersion}
                </p>
                <OutcomeBadge outcome={report.outcome} />
              </div>
              <h2 className="mt-3 max-w-4xl text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">
                {report.narrative.headline}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-app-text-secondary">
                {outcomeCopy}
              </p>
              <div className="data-meta mt-4 flex flex-wrap gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <RiCalendarLine aria-hidden="true" /> Generado {generatedLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <RiFlagLine aria-hidden="true" /> Vista segura para el alumno
                </span>
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onExport}>
            <RiDownload2Line aria-hidden="true" />
            Exportar Markdown
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ReportGrade
          label="Calificación"
          value={report.grade.value}
          badge={report.grade.status === "OFFICIAL" ? "Oficial" : "Provisional"}
          tone={report.grade.status === "OFFICIAL" ? "success" : "primary"}
        />
        <section className="rounded-2xl border border-primary/20 bg-app-surface p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary">
              <RiRoadMapLine className="text-xl" aria-hidden="true" />
            </div>
            <div>
              <p className="ui-label text-primary">Plan de mejora</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-app-text">
                Tus próximos pasos
              </h3>
              <p className="mt-1 text-sm leading-6 text-app-text-secondary">
                Empieza por la primera acción y vuelve a evaluar tu siguiente versión.
              </p>
            </div>
            <span className="ml-auto hidden rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-1 text-[11px] font-semibold text-primary sm:inline-flex">
              {report.nextSteps.length} {report.nextSteps.length === 1 ? "acción" : "acciones"}
            </span>
          </div>
          <ol className="mt-5 space-y-3 text-sm leading-6 text-app-text-secondary">
            {report.nextSteps.length > 0 ? (
              report.nextSteps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-app-border px-4 py-3 text-app-text-muted">
                No hay acciones adicionales para esta entrega.
              </li>
            )}
          </ol>
        </section>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <StudentNarrativeCard
          eyebrow="Fortalezas"
          title="Lo que ya funciona"
          items={report.narrative.achievements}
          icon={RiCheckboxCircleLine}
          tone="success"
          emptyLabel="Aún no hay logros destacados en esta versión."
        />
        <StudentNarrativeCard
          eyebrow="Atención"
          title="Dónde concentrarte"
          items={report.narrative.gaps}
          icon={RiFlagLine}
          tone={narrativeTone}
          emptyLabel="No se han detectado brechas prioritarias."
        />
        <StudentNarrativeCard
          eyebrow="Comprender"
          title="Puentes de aprendizaje"
          items={report.narrative.conceptBridges}
          icon={RiLightbulbFlashLine}
          tone="primary"
          emptyLabel="No hay conceptos adicionales sugeridos para esta entrega."
        />
      </section>

      <EvidenceSection evidence={report.evidence} />
      <ComparisonSection comparison={report.comparison} />
      <RubricSection criteria={report.rubric} />

      <details className="group overflow-hidden rounded-2xl border border-app-border bg-app-surface shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 hover:bg-app-bg-subtle/40 sm:px-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg-subtle text-app-text-secondary">
            <RiInformationLine className="text-xl" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="ui-label">Información ampliada</span>
            <span className="mt-1 block text-base font-semibold text-app-text">
              Detalles técnicos avanzados
            </span>
          </span>
          <span className="hidden rounded-full border border-app-border bg-app-bg-subtle px-2.5 py-1 text-[11px] font-semibold text-app-text-muted sm:inline-flex">
            {report.advanced.findings.length} {report.advanced.findings.length === 1 ? "hallazgo" : "hallazgos"}
          </span>
          <RiArrowDownSLine className="text-xl text-app-text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="space-y-5 border-t border-app-border bg-app-bg-subtle/25 p-5 sm:p-6">
          <FindingsSection
            title="Hallazgos técnicos"
            findings={report.advanced.findings}
          />
          {report.advanced.warnings.length > 0 ? (
            <div className="rounded-xl border border-warning/30 bg-warning-subtle p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-warning">
                <RiInformationLine aria-hidden="true" />
                Avisos de la evaluación
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
                {report.advanced.warnings.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {report.limitations.length ? (
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <h3 className="font-semibold text-app-text">Límites de la evaluación</h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
                {report.limitations.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-app-text-muted" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>

      {buildRunId ? (
        <TutorChatBlock buildRunId={buildRunId} report={report} />
      ) : null}
    </div>
  );
}

function StudentNarrativeCard({
  eyebrow,
  title,
  items,
  icon: Icon,
  tone,
  emptyLabel,
}: {
  eyebrow: string;
  title: string;
  items: string[];
  icon: IconType;
  tone: "primary" | "success" | "warning" | "danger";
  emptyLabel: string;
}): JSX.Element {
  const styles = {
    primary: {
      card: "border-primary/20",
      icon: "bg-primary-subtle text-primary",
      eyebrow: "text-primary",
      marker: "bg-primary",
    },
    success: {
      card: "border-success/25",
      icon: "bg-success-subtle text-success",
      eyebrow: "text-success",
      marker: "bg-success",
    },
    warning: {
      card: "border-warning/30",
      icon: "bg-warning-subtle text-warning",
      eyebrow: "text-warning",
      marker: "bg-warning",
    },
    danger: {
      card: "border-danger/25",
      icon: "bg-danger-subtle text-danger",
      eyebrow: "text-danger",
      marker: "bg-danger",
    },
  }[tone];

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
    </article>
  );
}
