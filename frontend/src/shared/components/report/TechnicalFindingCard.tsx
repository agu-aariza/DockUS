/**
 * @fileoverview Componente de informe de evaluación y desglose pedagógico (TechnicalFindingCard).
 *
 * @module TechnicalFindingCard
 */

import type { BuilderRuntimeFamily } from "../../../features/builder/types";
import { CodeSnippet } from "../CodeSnippet";
import { MarkdownContent } from "../MarkdownContent";
import { SeverityBadge } from "./SeverityBadge";
import { normalizeTechnicalFeedbackItem } from "../../utils/technicalFeedback";

interface TechnicalFindingCardProps {
  item: ReturnType<typeof normalizeTechnicalFeedbackItem>;
  runtimeFamily?: BuilderRuntimeFamily;
  variant?: "default" | "compact";
}

export function TechnicalFindingCard({
  item,
  runtimeFamily,
  variant = "default",
}: TechnicalFindingCardProps): JSX.Element {
  const padding = variant === "compact" ? "p-3" : "p-4";
  const spacing = variant === "compact" ? "mt-2" : "mt-4";

  return (
    <article className={`rounded-xl border border-app-border bg-white text-sm ${padding}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="font-semibold text-slate-900">{item.title}</span>
        <SeverityBadge severity={item.severity} level={item.level} />
      </div>

      <div className="mt-2 text-slate-500">
        <MarkdownContent content={item.detail} />
      </div>

      {item.file ? (
        <div className="mt-2 inline-block rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-400">
          {item.file}
          {item.line ? `:${item.line}` : ""}
        </div>
      ) : null}

      <CodeSnippet code={item.codeSnippet} runtimeFamily={runtimeFamily} />

      {item.conceptExplanation.trim() ? (
        <details className={`${spacing} rounded-xl border border-app-border bg-slate-50 px-4 py-3`}>
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            Aprende mas
          </summary>
          <div className="mt-3 text-slate-500">
            <MarkdownContent content={item.conceptExplanation} />
          </div>
        </details>
      ) : null}
    </article>
  );
}
