import type {
  ReportComparisonView,
  ReportCriterionView,
  ReportEvidenceView,
  ReportFindingView,
} from "@educodeai/contracts";

export function ReportGrade({
  label,
  value,
  badge,
}: {
  label: string;
  value: number | null;
  badge: string;
}) {
  return (
    <article className="rounded-lg border border-app-border bg-app-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="ui-label">{label}</span>
        <span className="rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary">
          {badge}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold text-app-text">
        {value === null ? "Pendiente" : value.toFixed(2)}
        {value !== null ? (
          <span className="text-base text-app-text-muted"> / 10</span>
        ) : null}
      </div>
    </article>
  );
}

export function RubricSection({
  criteria,
}: {
  criteria: ReportCriterionView[];
}) {
  return (
    <section className="rounded-lg border border-app-border bg-app-surface p-6">
      <h3 className="text-base font-semibold text-app-text">
        Rúbrica explicada
      </h3>
      <div className="mt-4 space-y-3">
        {criteria.map((criterion) => (
          <article
            key={criterion.id}
            className="rounded-lg border border-app-border bg-app-bg-subtle/40 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-app-text">{criterion.name}</h4>
              <span className="text-sm font-bold text-primary">
                {criterion.awarded.toFixed(2)} /{" "}
                {criterion.maxPoints.toFixed(2)}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-app-text-secondary">
              {criterion.explanation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EvidenceSection({
  evidence,
}: {
  evidence: ReportEvidenceView[];
}) {
  if (evidence.length === 0) return null;
  return (
    <section className="rounded-lg border border-app-border bg-app-surface p-6">
      <h3 className="text-base font-semibold text-app-text">Evidencia</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {evidence.map((item) => (
          <article
            key={item.id}
            className="rounded-lg border border-app-border p-4"
          >
            <div className="text-sm font-semibold text-app-text">
              {item.summary}
            </div>
            {item.detail ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-app-text-secondary">
                {item.detail}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function FindingsSection({
  title,
  findings,
}: {
  title: string;
  findings: ReportFindingView[];
}) {
  if (findings.length === 0) return null;
  return (
    <section className="rounded-lg border border-app-border bg-app-surface p-6">
      <h3 className="text-base font-semibold text-app-text">{title}</h3>
      <div className="mt-4 space-y-3">
        {findings.map((finding) => (
          <article
            key={finding.id}
            className="rounded-lg border border-app-border p-4"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-semibold text-app-text">{finding.title}</h4>
              <span className="rounded-full bg-app-bg-subtle px-2 py-0.5 text-xs font-semibold uppercase text-app-text-muted">
                {finding.severity}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-app-text-secondary">
              {finding.explanation}
            </p>
            <p className="mt-2 text-sm font-medium text-app-text">
              Siguiente acción: {finding.recommendation}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ComparisonSection({
  comparison,
}: {
  comparison: ReportComparisonView;
}) {
  if (!comparison) return null;
  if ("reason" in comparison) {
    const label =
      comparison.reason === "FIRST_ATTEMPT"
        ? "Es el primer intento comparable."
        : comparison.reason === "LEGACY_REPORT_NOT_COMPARABLE"
          ? "El intento anterior usa el formato histórico y no se compara automáticamente."
          : "No hay un run anterior completado que sirva de referencia.";
    return (
      <p className="rounded-lg border border-app-border bg-app-surface p-4 text-sm text-app-text-muted">
        {label}
      </p>
    );
  }
  const groups = [
    ["Mejoran", comparison.improvedCriteria],
    ["Empeoran", comparison.regressedCriteria],
    ["Bloqueos resueltos", comparison.resolvedBlockers],
    ["Bloqueos persistentes", comparison.persistentBlockers],
    ["Bloqueos nuevos", comparison.newBlockers],
  ] as const;
  return (
    <section className="rounded-lg border border-app-border bg-app-surface p-6">
      <h3 className="text-base font-semibold text-app-text">
        Evolución desde la entrega v{comparison.baselineDeliveryVersion}
      </h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {groups.map(([label, items]) => (
          <div key={label} className="rounded-lg bg-app-bg-subtle/60 p-4">
            <div className="text-xs font-semibold uppercase text-app-text-muted">
              {label}
            </div>
            <p className="mt-2 text-sm text-app-text-secondary">
              {items.length ? items.join(" · ") : "Sin cambios"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
