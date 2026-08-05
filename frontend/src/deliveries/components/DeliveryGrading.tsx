/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (DeliveryGrading).
 *
 * @module DeliveryGrading
 */

import { RiAlertLine } from "react-icons/ri";
import { BuildRunEntity, DeliveryEntity } from "../../shared/types";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { TeacherReviewSummary } from "./TeacherReviewSummary";

interface GradingFormValue {
  id: string;
  grade: string;
  graderNotes: string;
}

export function DeliveryGrading({
  selectedDelivery,
  reportRun,
  selectedDeliveryReviewNotes,
  canWrite,
  gradingForm,
  onSetGradingForm,
  onHandleGradingUpdate,
}: {
  selectedDelivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  selectedDeliveryReviewNotes: { manualNotes?: string | null; legacyBlocks?: string[] };
  canWrite: boolean;
  gradingForm: GradingFormValue;
  onSetGradingForm: (_updater: (_current: GradingFormValue) => GradingFormValue) => void;
  onHandleGradingUpdate: (_event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <TeacherReviewSummary
        delivery={selectedDelivery}
        latestRun={reportRun}
        manualGraderNotes={selectedDeliveryReviewNotes.manualNotes}
        legacyAiEvidence={selectedDeliveryReviewNotes.legacyBlocks}
      />

      {canWrite ? (
        <form
          className="rounded-lg border border-app-border bg-app-surface p-6"
          onSubmit={onHandleGradingUpdate}
        >
          <div className="border-b border-app-border pb-4">
            <p className="ui-label">Calificación</p>
            <h4 className="mt-1 text-base font-semibold text-app-text">
              Consolida la nota oficial
            </h4>
            <p className="mt-1 text-sm leading-6 text-app-text-secondary">
              La nota vive en la entrega, no en el run del builder. Usa este bloque para cerrar evaluación académica y feedback manual.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <label htmlFor="delivery-grading-grade" className="label-text">Nota oficial</label>
              <input
                id="delivery-grading-grade"
                type="number"
                min="0"
                max="10"
                step="0.01"
                className="input-field"
                value={gradingForm.grade}
                onChange={(event) =>
                  onSetGradingForm((current) => ({
                    ...current,
                    grade: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label htmlFor="delivery-grading-notes" className="label-text">Observaciones del corrector</label>
              <textarea
                id="delivery-grading-notes"
                className="input-field min-h-[160px]"
                value={gradingForm.graderNotes}
                onChange={(event) =>
                  onSetGradingForm((current) => ({
                    ...current,
                    graderNotes: event.target.value,
                  }))
                }
                placeholder="Comentarios manuales para el alumno"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-app-border pt-4">
            <div className="text-sm text-app-text-muted">
              {selectedDelivery.grade === null
                ? "Aún no existe una nota oficial publicada."
                : "La entrega ya tenía nota; este guardado la reemplazará."}
            </div>
            <Button type="submit" variant="primary" size="sm">
              Guardar calificación
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border border-app-border bg-app-surface p-6">
          <EmptyState
            icon={<RiAlertLine className="text-3xl text-app-text-muted" />}
            title="Solo lectura"
            description="Tu rol actual no permite modificar la calificación oficial de esta entrega."
          />
        </div>
      )}
    </section>
  );
}
