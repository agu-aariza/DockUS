import type { StudentReportView as StudentReport } from "@educodeai/contracts";
import { Button } from "../../shared/components/ui/Button";
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
}: {
  report: StudentReport;
  onExport: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-app-border bg-app-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ui-label">
              Informe para el alumno · entrega v{report.deliveryVersion}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-app-text">
              {report.narrative.headline}
            </h2>
          </div>
          <Button variant="secondary" size="sm" onClick={onExport}>
            Exportar Markdown
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <ReportGrade
          label="Calificación"
          value={report.grade.value}
          badge={report.grade.status === "OFFICIAL" ? "Oficial" : "Provisional"}
        />
        <section className="rounded-lg border border-primary/20 bg-primary-subtle p-5">
          <h3 className="font-semibold text-app-text">Tus próximos pasos</h3>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-app-text-secondary">
            {report.nextSteps.map((step, index) => (
              <li key={`${step}-${index}`}>
                <span className="mr-2 font-bold text-primary">
                  {index + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      <EvidenceSection evidence={report.evidence} />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border border-app-border bg-app-surface p-5">
          <h3 className="font-semibold text-app-text">Lo que ya funciona</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-app-text-secondary">
            {report.narrative.achievements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-lg border border-app-border bg-app-surface p-5">
          <h3 className="font-semibold text-app-text">Dónde concentrarte</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-app-text-secondary">
            {report.narrative.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <ComparisonSection comparison={report.comparison} />
      <RubricSection criteria={report.rubric} />

      <details className="rounded-lg border border-app-border bg-app-surface">
        <summary className="cursor-pointer px-6 py-4 font-semibold text-app-text">
          Detalles técnicos avanzados
        </summary>
        <div className="space-y-5 border-t border-app-border p-6">
          <FindingsSection
            title="Hallazgos técnicos"
            findings={report.advanced.findings}
          />
          {report.limitations.length ? (
            <div>
              <h3 className="font-semibold text-app-text">
                Límites de la evaluación
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-app-text-secondary">
                {report.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}
