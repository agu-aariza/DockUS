import type { BuilderOutcome } from "../../../features/builder/types";
import type { ProjectProgressSummary } from "../../../features/projects/types";

const OUTCOME_BAR_CLASS: Record<BuilderOutcome, string> = {
  PASS: "bg-success-500",
  PARTIAL: "bg-warning-500",
  FAIL: "bg-rose-500",
  UNKNOWN: "bg-slate-400",
};

const OUTCOME_ORDER: BuilderOutcome[] = ["PASS", "PARTIAL", "FAIL", "UNKNOWN"];

interface DistributionChartsProps {
  summary: ProjectProgressSummary;
  total: number;
}

function widthOf(value: number, total: number): string {
  return total > 0 ? `${(value / total) * 100}%` : "0%";
}

export function DistributionCharts({
  summary,
  total,
}: DistributionChartsProps): JSX.Element {
  const statusSegments = [
    { key: "pending", value: summary.statusTotals.pending, color: "bg-slate-400" },
    { key: "submitted", value: summary.statusTotals.submitted, color: "bg-primary" },
    { key: "inReview", value: summary.statusTotals.inReview, color: "bg-warning-500" },
    { key: "evaluated", value: summary.statusTotals.evaluated, color: "bg-success-500" },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-lg border border-app-border bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
          Estados de entrega
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Distribución por último estado conocido dentro del filtro de grupo.
        </p>
        <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
          {statusSegments.map((segment) => (
            <div
              key={segment.key}
              className={segment.color}
              style={{ width: widthOf(segment.value, total) }}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
          <div>
            Pendientes: <strong>{summary.statusTotals.pending}</strong>
          </div>
          <div>
            Entregadas: <strong>{summary.statusTotals.submitted}</strong>
          </div>
          <div>
            En revisión: <strong>{summary.statusTotals.inReview}</strong>
          </div>
          <div>
            Evaluadas: <strong>{summary.statusTotals.evaluated}</strong>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-app-border bg-white p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
          Resultado del builder
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Último outcome automático registrado por alumno.
        </p>
        <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
          {OUTCOME_ORDER.map((outcome) => (
            <div
              key={outcome}
              className={OUTCOME_BAR_CLASS[outcome]}
              style={{ width: widthOf(summary.outcomeTotals[outcome], total) }}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600">
          {OUTCOME_ORDER.map((outcome) => (
            <div key={outcome}>
              {outcome}: <strong>{summary.outcomeTotals[outcome]}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
