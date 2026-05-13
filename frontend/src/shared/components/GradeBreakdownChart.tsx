import { useState } from "react";
import { RiArrowDownSLine, RiArrowUpSLine } from "react-icons/ri";

import type { RubricGradeItem } from "../types";
import { MarkdownContent } from "./MarkdownContent";

interface GradeBreakdownChartProps {
  items: RubricGradeItem[];
}

function resolveTone(percentage: number): {
  bar: string;
  chip: string;
} {
  if (percentage >= 0.8) {
    return {
      bar: "bg-emerald-500",
      chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (percentage >= 0.5) {
    return {
      bar: "bg-amber-500",
      chip: "border-amber-200 bg-amber-50 text-amber-700",
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

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Desglose de la nota
        </p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Como contribuye cada criterio a la evaluacion
        </h3>
      </div>

      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const percentage =
            item.maxPoints > 0 ? Math.max(0, Math.min(1, item.awarded / item.maxPoints)) : 0;
          const tone = resolveTone(percentage);
          const isExpanded = expandedCriterion === item.criterion;

          return (
            <article
              key={item.criterion}
              className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    {item.criterion}
                  </h4>
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
                className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-blue transition hover:text-brand-blue-dark"
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
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <MarkdownContent content={item.justification} />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
