/**
 * @fileoverview Componente de informe de evaluación y desglose pedagógico (TechnicalFindingCard).
 *
 * @module TechnicalFindingCard
 */

import type {
  BuilderRuntimeFamily,
  TechnicalFeedbackItem,
} from "../../../features/builder/types";
import { CodeSnippet } from "../CodeSnippet";
import { MarkdownContent } from "../MarkdownContent";
import { SeverityBadge } from "./SeverityBadge";
import {
  normalizeTechnicalFeedbackItem,
  splitFindingDetail,
} from "../../utils/technicalFeedback";

interface TechnicalFindingCardProps {
  item: ReturnType<typeof normalizeTechnicalFeedbackItem>;
  runtimeFamily?: BuilderRuntimeFamily;
  variant?: "default" | "compact";
  /** Hallazgos del mismo archivo:línea, plegados dentro de esta tarjeta. */
  related?: TechnicalFeedbackItem[];
  /** Un elogio no tiene severidad: lleva su propio distintivo. */
  tone?: "finding" | "strength";
}

/** `BUENA PRÁCTICA: Uso de const` bajo el epígrafe de fortalezas es redundante. */
function displayTitle(title: string, tone: "finding" | "strength"): string {
  if (tone !== "strength") {
    return title;
  }

  return title.replace(/^\s*buena\s+pr[aá]ctica\s*:?\s*/iu, "").trim() || title;
}

export function TechnicalFindingCard({
  item,
  runtimeFamily,
  variant = "default",
  related = [],
  tone = "finding",
}: TechnicalFindingCardProps): JSX.Element {
  const padding = variant === "compact" ? "p-3" : "p-4";
  const spacing = variant === "compact" ? "mt-2" : "mt-4";
  const detail = splitFindingDetail(item.detail);
  const hasSplitDetail = Boolean(detail.impact || detail.recommendation);

  return (
    <article className={`rounded-xl border border-app-border bg-white text-sm ${padding}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="font-semibold text-slate-900">
          {displayTitle(item.title, tone)}
        </span>
        {tone === "strength" ? (
          <span className="inline-flex items-center rounded-full border border-success-200 bg-success-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-success-700">
            Buena práctica
          </span>
        ) : (
          <SeverityBadge severity={item.severity} level={item.level} />
        )}
      </div>

      {hasSplitDetail ? (
        <div className="mt-2 space-y-2">
          <div className="text-slate-500">
            <MarkdownContent content={detail.observation} />
          </div>
          {detail.impact ? (
            <div className="text-slate-500">
              <span className="font-semibold text-slate-600">Impacto: </span>
              {detail.impact}
            </div>
          ) : null}
          {detail.recommendation ? (
            <div
              className={`rounded-lg border px-3 py-2 ${
                tone === "strength"
                  ? "border-success-200 bg-success-50/50 text-success-800"
                  : "border-primary/20 bg-primary/5 text-slate-700"
              }`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                {tone === "strength" ? "Mantén esto" : "Qué hacer"}
              </span>
              <p className="mt-1 leading-relaxed">{detail.recommendation}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-2 text-slate-500">
          <MarkdownContent content={item.detail} />
        </div>
      )}

      {item.file ? (
        <div className="mt-2 inline-block rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-400">
          {item.file}
          {item.line ? `:${item.line}` : ""}
        </div>
      ) : null}

      {related.length > 0 ? (
        <ul className="mt-3 space-y-2 border-l-2 border-app-border pl-3">
          {related.map((extra, index) => {
            const normalized = normalizeTechnicalFeedbackItem(extra);
            const extraDetail = splitFindingDetail(normalized.detail);
            return (
              <li key={`${normalized.title}-${index}`} className="text-slate-500">
                <span className="font-medium text-slate-700">
                  {normalized.title}
                </span>
                {extraDetail.recommendation ? (
                  <span> — {extraDetail.recommendation}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <CodeSnippet
        code={item.codeSnippet}
        runtimeFamily={runtimeFamily}
        file={item.file}
      />

      {item.conceptExplanation.trim() ? (
        <details className={`${spacing} rounded-xl border border-app-border bg-slate-50 px-4 py-3`}>
          <summary className="cursor-pointer text-sm font-semibold text-primary">
            Aprende más
          </summary>
          <div className="mt-3 text-slate-500">
            <MarkdownContent content={item.conceptExplanation} />
          </div>
        </details>
      ) : null}
    </article>
  );
}
