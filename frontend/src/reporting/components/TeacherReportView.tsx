import type { TeacherReportView as TeacherReport } from "@educodeai/contracts";
import { Button } from "../../shared/components/ui/Button";
import {
  ComparisonSection,
  EvidenceSection,
  FindingsSection,
  ReportGrade,
  RubricSection,
} from "./report-v3/ReportPrimitives";

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
}) {
  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-app-border bg-app-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-label">
              Informe docente · entrega v{report.deliveryVersion}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-app-text">
              {report.narrative.executiveSummary}
            </h2>
            <p className="mt-2 text-sm text-app-text-muted">
              Confianza de la evaluación: {report.confidence}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onExportStudent}>
              Exportar vista alumno
            </Button>
            <Button variant="secondary" size="sm" onClick={onExport}>
              Exportar vista docente
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <ReportGrade
          label="Propuesta de la IA"
          value={report.grade.provisional}
          badge="Provisional"
        />
        <ReportGrade
          label="Decisión académica"
          value={report.grade.official}
          badge="Oficial"
        />
      </div>
      {report.grade.provisional !== null && onUseAiGrade ? (
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onUseAiGrade(report.grade.provisional as number)}
          >
            Usar propuesta de la IA
          </Button>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-app-border bg-app-surface p-5">
          <h3 className="font-semibold text-app-text">Fortalezas</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-app-text-secondary">
            {report.narrative.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-lg border border-app-border bg-app-surface p-5">
          <h3 className="font-semibold text-app-text">
            Preocupaciones y seguimiento
          </h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-app-text-secondary">
            {[...report.narrative.concerns, ...report.narrative.followUp].map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </article>
      </section>

      <ComparisonSection comparison={report.comparison} />
      <RubricSection criteria={report.rubric} />
      <EvidenceSection evidence={report.evidence} />
      <FindingsSection title="Hallazgos técnicos" findings={report.findings} />

      {report.reviewFlags.length ? (
        <section className="rounded-lg border border-warning-200 bg-warning-50 p-5">
          <h3 className="font-semibold text-warning-900">
            Revisión recomendada
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-warning-800">
            {report.reviewFlags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-lg border border-app-border bg-app-surface">
        <summary className="cursor-pointer px-6 py-4 font-semibold text-app-text">
          Vista previa exacta del alumno
        </summary>
        <div className="border-t border-app-border p-6">
          <div className="rounded-lg bg-app-bg-subtle p-5">
            <h3 className="font-semibold text-app-text">
              {report.studentPreview.narrative.headline}
            </h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-app-text-secondary">
              {report.studentPreview.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </div>
  );
}
