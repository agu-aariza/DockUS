/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (TeacherReviewSummary).
 *
 * @module TeacherReviewSummary
 */

import { RiAwardLine, RiRobot2Line, RiScales3Line } from "react-icons/ri";
import { MetricCard } from "../../shared/components/MetricCard";
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
        <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-900 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-300">
          <strong>Falta consolidar nota oficial.</strong> El builder ya dejó
          cierre técnico legible, pero esta entrega aún no tiene calificación
          docente publicada.
        </div>
      ) : null}

      {/* auto-fit, no lg:grid-cols-3: este bloque vive tanto a ancho completo
          (pestaña Informe) como en la mitad de un split (pestaña
          Calificación) — un breakpoint de viewport no sabe cuánto sitio le
          queda a su propio contenedor, así que se apoya en el ancho real. */}
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
        <MetricCard
          label="Nota recomendada"
          value={formatGrade(recommendedGrade)}
          helper={
            recommendedGrade === null
              ? "Carga el último informe técnico para comparar el criterio automático."
              : "Referencia técnica derivada del último run asociado."
          }
          icon={<RiRobot2Line />}
          variant="default"
        />

        <MetricCard
          label="Nota oficial"
          value={formatGrade(officialGrade)}
          helper={
            officialGrade === null
              ? "Todavía no hay decisión académica consolidada en la entrega."
              : "Esta es la nota manual/oficial visible para el alumno."
          }
          icon={<RiAwardLine />}
          variant={officialGrade === null ? "warning" : "success"}
        />

        <article className="rounded-lg border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-1.5 text-app-text-muted">
            <RiScales3Line className="text-sm" />
            <span className="ui-label">Alineación docente</span>
          </div>
          <div className="mt-2 text-base font-semibold text-app-text">
            {gradeDelta === null
              ? `Estado técnico: ${technicalState}`
              : gradeDelta === 0
                ? "Coincide con el criterio técnico"
                : `${gradeDelta > 0 ? "+" : ""}${gradeDelta.toFixed(2)} frente a la recomendación`}
          </div>
          <p className="mt-2 text-sm text-app-text-muted">
            {gradeDelta === null
              ? "Úsalo para decidir si la entrega ya puede cerrarse académicamente."
              : "Hace visible cuándo la decisión oficial se aparta de la recomendación del builder."}
          </p>
        </article>
      </div>

      <article className="rounded-lg border border-app-border bg-app-surface p-5">
        <p className="ui-label">Observaciones docentes oficiales</p>
        <p className="mt-3 text-sm leading-6 text-app-text-secondary">
          {manualGraderNotes?.trim() ||
            "Todavía no hay observaciones manuales consolidadas."}
        </p>

        {legacyAiEvidence.length > 0 ? (
          <div className="mt-5 rounded-lg border border-app-border bg-app-bg-subtle p-4">
            <p className="ui-label">Evidencia AI histórica</p>
            <div className="mt-3 space-y-3 text-sm leading-6 text-app-text-secondary">
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
