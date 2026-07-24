/**
 * @fileoverview Componente de monitorización de ejecuciones SSE en vivo (LlmAssessmentPanel).
 *
 * @module LlmAssessmentPanel
 */

import {
  cn,
  confidenceLabel,
  evaluativeStateTextClass,
  GRADE_TEXT_CLASS,
  gradeTone,
  normalizeItems,
  type LlmAssessment,
} from "./liveRunUtils";

interface LlmAssessmentPanelProps {
  assessment: LlmAssessment;
}

/**
 * El veredicto del evaluador. Distingue explícitamente lo que el sistema pudo observar
 * de lo que no pudo validar: esa frontera es lo que el profesor necesita para fiarse
 * (o no) de la nota propuesta.
 */
export function LlmAssessmentPanel({
  assessment,
}: LlmAssessmentPanelProps): JSX.Element {
  const observedEvidence = normalizeItems(assessment.observedEvidence);
  const evaluationLimits = normalizeItems(assessment.evaluationLimits);
  const showAssessmentContext =
    observedEvidence.length > 0 || evaluationLimits.length > 0;
  const grade = assessment.recommendedGrade;

  return (
    <section className="mb-6 rounded-lg border border-app-border bg-white">
      <div className="flex flex-col gap-5 border-b border-app-border px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="accent-rule mb-2" aria-hidden="true" />
          <div className="ui-label">Veredicto del evaluador</div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">
            {assessment.structuralType}
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
            {assessment.rationale}
          </p>
        </div>

        <dl className="flex shrink-0 items-start gap-6 lg:pl-6">
          <Reading
            label="Estado"
            value={assessment.evaluativeState ?? "—"}
            className={evaluativeStateTextClass(assessment.evaluativeState)}
          />
          <Reading
            label="Confianza"
            value={confidenceLabel(assessment.confidence)}
            className="text-slate-700"
          />
          {grade !== undefined && (
            <Reading
              label="Nota propuesta"
              value={grade.toFixed(2)}
              className={GRADE_TEXT_CLASS[gradeTone(grade)]}
            />
          )}
        </dl>
      </div>

      {assessment.evidenceSummary && (
        <p className="border-b border-app-border px-5 py-3 text-sm leading-relaxed text-slate-500">
          {assessment.evidenceSummary}
        </p>
      )}

      {showAssessmentContext && (
        <div className="grid gap-px bg-app-border lg:grid-cols-2">
          {observedEvidence.length > 0 && (
            <EvidenceList
              title="Lo que el sistema observó"
              items={observedEvidence}
              markerClass="bg-success"
            />
          )}
          {evaluationLimits.length > 0 && (
            <EvidenceList
              title="Lo que no pudo validar"
              items={evaluationLimits}
              markerClass="bg-warning"
            />
          )}
        </div>
      )}
    </section>
  );
}

function Reading({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}): JSX.Element {
  return (
    <div className="text-right">
      <dt className="ui-label">{label}</dt>
      <dd className={cn("data-figure mt-1 text-xl font-semibold", className)}>{value}</dd>
    </div>
  );
}

function EvidenceList({
  title,
  items,
  markerClass,
}: {
  title: string;
  items: string[];
  markerClass: string;
}): JSX.Element {
  return (
    <article className="bg-white px-5 py-4">
      <h4 className="ui-label">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
            <span
              className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", markerClass)}
              aria-hidden="true"
            />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
