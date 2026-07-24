/**
 * @fileoverview Componente compartido de la interfaz DockUS (AssessmentContextSummary).
 *
 * @module AssessmentContextSummary
 */

import type { BuildRunEntity } from "../../features/builder/types";
import { GlossaryTerm } from "./Glossary";
import { MarkdownContent } from "./MarkdownContent";
import { ReportCard } from "./report/ReportCard";

interface AssessmentContextSummaryProps {
  llmAssessment: BuildRunEntity["llmAssessment"];
  mode?: "student" | "teacher";
}

function normalizeItems(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean);
}

export function AssessmentContextSummary({
  llmAssessment,
  mode = "teacher",
}: AssessmentContextSummaryProps): JSX.Element | null {
  if (!llmAssessment) {
    return null;
  }

  const observedEvidence = normalizeItems(llmAssessment.observedEvidence);
  const evaluationLimits = normalizeItems(llmAssessment.evaluationLimits);
  const capabilities = llmAssessment.capabilities
    ? Object.entries(llmAssessment.capabilities)
    : [];

  if (
    !llmAssessment.evidenceSummary &&
    observedEvidence.length === 0 &&
    evaluationLimits.length === 0 &&
    capabilities.length === 0
  ) {
    return null;
  }

  const description =
    mode === "student"
      ? "Este summary separa lo que el sistema sí pudo comprobar de lo que quedó fuera de alcance."
      : "Resumen curado de evidencia y límites del análisis automático.";

  return (
    <ReportCard
      tone={mode === "student" ? "sky" : "default"}
      title="Evidencia curada del análisis"
      description={description}
    >
      {llmAssessment.evidenceSummary ? (
        <div className="mt-4 rounded-xl border border-app-border bg-slate-50/70 p-4 text-slate-700">
          <MarkdownContent content={llmAssessment.evidenceSummary} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {observedEvidence.length > 0 ? (
          <article className="rounded-xl border border-success-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-success-700">
              Qué observó el sistema
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {observedEvidence.map((item) => (
                <li key={item} className="rounded-xl bg-success-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {evaluationLimits.length > 0 ? (
          <article className="rounded-xl border border-warning-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-warning-700">
              Lo que no pudo validar
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {evaluationLimits.map((item) => (
                <li key={item} className="rounded-xl bg-warning-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>

      {capabilities.length > 0 ? (
        <article className="mt-4 rounded-xl border border-sky-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            <GlossaryTerm term="Capacidades">Capacidades</GlossaryTerm>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {capabilities.map(([capabilityId, capability]) => (
              <div
                key={capabilityId}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">
                    <GlossaryTerm term={capabilityId}>{capabilityId}</GlossaryTerm>
                  </span>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {capability.status}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {capability.rationale}
                </p>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </ReportCard>
  );
}
