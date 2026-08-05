/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (GradeBreakdownChart).
 *
 * @module GradeBreakdownChart
 */

import { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";

import type { RubricGradeItem } from "../../features/builder/types";
import { MarkdownContent } from "./MarkdownContent";
import { ReportCard } from "./report/ReportCard";

interface GradeBreakdownChartProps {
  items: RubricGradeItem[];
}

function resolveTone(percentage: number): {
  bar: string;
  chip: string;
} {
  if (percentage >= 0.8) {
    return {
      bar: "bg-success-500",
      chip: "border-success-200 bg-success-50 text-success-700",
    };
  }
  if (percentage >= 0.5) {
    return {
      bar: "bg-warning-500",
      chip: "border-warning-200 bg-warning-50 text-warning-700",
    };
  }
  return {
    bar: "bg-rose-500",
    chip: "border-rose-200 bg-rose-50 text-rose-700",
  };
}

export function GradeBreakdownChart({
  items,
}: GradeBreakdownChartProps): JSX.Element | null {
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

  if (items.length === 0) {
    return null;
  }

  const hasWeights = items.some((item) => typeof item.weight === "number");

  return (
    <ReportCard
      tone="default"
      title="Desglose de la nota"
      description={
        hasWeights
          ? "Rúbrica ponderada del proyecto: peso y puntuación de cada criterio"
          : "Cómo contribuye cada criterio a la evaluación"
      }
    >
      <div className="space-y-4">
        {items.map((item) => {
          const percentage =
            item.maxPoints > 0 ? Math.max(0, Math.min(1, item.awarded / item.maxPoints)) : 0;
          const tone = resolveTone(percentage);
          const isExpanded = expandedCriterion === item.criterion;

          return (
            <article
              key={item.criterion}
              className="rounded-xl border border-app-border bg-slate-50/70 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-slate-900">
                      {item.criterion}
                    </h4>
                    {typeof item.weight === "number" ? (
                      <span className="inline-flex w-fit rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        Peso {item.weight}%
                      </span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <p className="mt-1 text-xs text-slate-500">{item.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {item.awarded.toFixed(2)} / {item.maxPoints.toFixed(2)} puntos
                  </p>
                </div>
                <span
                  className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${tone.chip}`}
                >
                  {Math.round(percentage * 100)}%
                </span>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${tone.bar}`}
                  style={{ width: `${Math.max(6, Math.round(percentage * 100))}%` }}
                />
              </div>

              <button
                type="button"
                className="mt-4 flex items-center gap-2 text-sm font-semibold text-primary transition hover:text-primary-hover"
                onClick={() =>
                  setExpandedCriterion((current) =>
                    current === item.criterion ? null : item.criterion,
                  )
                }
                aria-expanded={isExpanded}
              >
                {isExpanded ? <RiArrowUpSLine /> : <RiArrowDownSLine />}
                {isExpanded ? "Ocultar justificacion" : "Ver justificacion"}
              </button>

              {isExpanded ? (
                <div className="mt-3 rounded-xl border border-app-border bg-white p-4">
                  <MarkdownContent content={item.justification} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </ReportCard>
  );
}
