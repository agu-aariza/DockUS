import type { BuildRunEntity } from "../types";

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

  if (
    !llmAssessment.evidenceSummary &&
    observedEvidence.length === 0 &&
    evaluationLimits.length === 0
  ) {
    return null;
  }

  const sectionTone =
    mode === "student"
      ? "border-sky-200 bg-sky-50/70"
      : "border-slate-200 bg-slate-50";
  const description =
    mode === "student"
      ? "Este resumen separa lo que el sistema si pudo comprobar de lo que quedo fuera de alcance."
      : "Resumen curado de evidencia y limites del analisis automatico.";

  return (
    <section className={`rounded-3xl border p-6 ${sectionTone}`}>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
          Evidencia curada del analisis
        </h3>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      {llmAssessment.evidenceSummary ? (
        <p className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4 text-sm leading-6 text-slate-700">
          {llmAssessment.evidenceSummary}
        </p>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {observedEvidence.length > 0 ? (
          <article className="rounded-2xl border border-emerald-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Que observo el sistema
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {observedEvidence.map((item) => (
                <li key={item} className="rounded-xl bg-emerald-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ) : null}

        {evaluationLimits.length > 0 ? (
          <article className="rounded-2xl border border-amber-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Lo que no pudo validar
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {evaluationLimits.map((item) => (
                <li key={item} className="rounded-xl bg-amber-50 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>
    </section>
  );
}
