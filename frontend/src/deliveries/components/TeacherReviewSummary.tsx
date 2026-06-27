import type { BuildRunEntity, DeliveryEntity } from "../../shared/types";

interface TeacherReviewSummaryProps {
  delivery: DeliveryEntity;
  latestRun?: BuildRunEntity | null;
  manualGraderNotes?: string | null;
  legacyAiEvidence?: string[];
}

function formatGrade(value?: number | null): string {
  return typeof value === "number" ? value.toFixed(2) : "Pendiente";
}

export function TeacherReviewSummary({
  delivery,
  latestRun = null,
  manualGraderNotes,
  legacyAiEvidence = [],
}: TeacherReviewSummaryProps): JSX.Element {
  const recommendedGrade = latestRun?.llmAssessment?.recommendedGrade ?? null;
  const officialGrade = delivery.grade ?? null;
  const gradeDelta =
    recommendedGrade !== null && officialGrade !== null
      ? officialGrade - recommendedGrade
      : null;
  const needsOfficialGrade =
    delivery.status === "EVALUATED" && officialGrade === null;
  const technicalState = latestRun?.report?.overallOutcome ?? "UNKNOWN";

  return (
    <div className="space-y-4">
      {needsOfficialGrade ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Falta consolidar nota oficial.</strong> El builder ya dejó
          cierre técnico legible, pero esta entrega aún no tiene calificación
          docente publicada.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-lg border border-app-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nota recomendada por el builder
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatGrade(recommendedGrade)}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {recommendedGrade === null
              ? "Carga el último informe técnico para comparar el criterio automático."
              : "Referencia técnica derivada del último run asociado."}
          </p>
        </article>

        <article className="rounded-lg border border-app-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nota oficial actual
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">
            {formatGrade(officialGrade)}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {officialGrade === null
              ? "Todavía no hay decisión académica consolidada en la entrega."
              : "Esta es la nota manual/oficial visible para el alumno."}
          </p>
        </article>

        <article className="rounded-lg border border-app-border bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alineación docente
          </div>
          <div className="mt-2 text-base font-semibold text-slate-900">
            {gradeDelta === null
              ? `Estado técnico: ${technicalState}`
              : gradeDelta === 0
                ? "Coincide con el criterio técnico"
                : `${gradeDelta > 0 ? "+" : ""}${gradeDelta.toFixed(2)} frente a la recomendación`}
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {gradeDelta === null
              ? "Úsalo para decidir si la entrega ya puede cerrarse académicamente."
              : "Hace visible cuándo la decisión oficial se aparta de la recomendación del builder."}
          </p>
        </article>
      </div>

      <article className="rounded-lg border border-app-border bg-white p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Observaciones docentes oficiales
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {manualGraderNotes?.trim() ||
            "Todavía no hay observaciones manuales consolidadas."}
        </p>

        {legacyAiEvidence.length > 0 ? (
          <div className="mt-5 rounded-lg border border-app-border bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidencia AI histórica
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              {legacyAiEvidence.map((block, index) => (
                <p key={`${index}-${block.slice(0, 24)}`}>{block}</p>
              ))}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}
