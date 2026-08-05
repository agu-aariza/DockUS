/**
 * @fileoverview Componente de progreso y métricas de proyectos (DistributionCharts).
 *
 * @module DistributionCharts
 */

import type { BuilderOutcome } from "../../../features/builder/types";
import type { ProjectProgressSummary } from "../../../features/projects/types";

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

const OUTCOME_COLOR: Record<BuilderOutcome, string> = {
  PASS: "bg-success-500",
  PARTIAL: "bg-warning-500",
  FAIL: "bg-danger",
  UNKNOWN: "bg-app-text-muted",
};

const OUTCOME_ORDER: BuilderOutcome[] = ["PASS", "PARTIAL", "FAIL", "UNKNOWN"];

interface DistributionChartsProps {
  summary: ProjectProgressSummary;
  total: number;
}

function widthOf(value: number, total: number): string {
  return total > 0 ? `${(value / total) * 100}%` : "0%";
}

// Barra segmentada: el hueco de 2px entre tramos es el color de la propia
// tarjeta (no un gris de "track"), así que separa sin dibujar un borde — y la
// leyenda comparte el mismo color que su tramo, en vez de una lista de texto
// sin ninguna clave visual que la conecte con la barra.
function SegmentedBar({
  title,
  description,
  segments,
  total,
}: {
  title: string;
  description: string;
  segments: Segment[];
  total: number;
}): JSX.Element {
  return (
    <div>
      <h4 className="text-sm font-semibold uppercase tracking-wider text-app-text">
        {title}
      </h4>
      <p className="mt-1 text-sm text-app-text-secondary">{description}</p>
      <div className="mt-5 flex h-4 gap-[2px] overflow-hidden rounded-full border border-app-border bg-app-surface">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.color}
            style={{ width: widthOf(segment.value, total) }}
          />
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-app-text-secondary">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-2">
            <span className={`h-2 w-2 shrink-0 rounded-full ${segment.color}`} aria-hidden="true" />
            {segment.label}: <strong className="text-app-text">{segment.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DistributionCharts({
  summary,
  total,
}: DistributionChartsProps): JSX.Element {
  const statusSegments: Segment[] = [
    { key: "pending", label: "Pendientes", value: summary.statusTotals.pending, color: "bg-app-text-muted" },
    { key: "submitted", label: "Entregadas", value: summary.statusTotals.submitted, color: "bg-primary" },
    { key: "inReview", label: "En revisión", value: summary.statusTotals.inReview, color: "bg-warning-500" },
    { key: "evaluated", label: "Evaluadas", value: summary.statusTotals.evaluated, color: "bg-success-500" },
  ];

  const outcomeSegments: Segment[] = OUTCOME_ORDER.map((outcome) => ({
    key: outcome,
    label: outcome,
    value: summary.outcomeTotals[outcome],
    color: OUTCOME_COLOR[outcome],
  }));

  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-6">
      <SegmentedBar
        title="Estados de entrega"
        description="Distribución por último estado conocido dentro del filtro de grupo."
        segments={statusSegments}
        total={total}
      />
      <div className="my-6 border-t border-app-border-subtle" />
      <SegmentedBar
        title="Resultado del builder"
        description="Último outcome automático registrado por alumno."
        segments={outcomeSegments}
        total={total}
      />
    </div>
  );
}
