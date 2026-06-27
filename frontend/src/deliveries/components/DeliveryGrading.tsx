import { RiAlertLine } from "react-icons/ri";
import { DeliveryEntity } from "../../shared/types";
import { Button } from "../../shared/components/ui/Button";
import { EmptyState } from "../../shared/components/EmptyState";
import { TeacherReviewSummary } from "./TeacherReviewSummary";

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
  reportRun: any;
  selectedDeliveryReviewNotes: { manualNotes?: string | null; legacyBlocks?: any };
  canWrite: boolean;
  gradingForm: { grade: string; graderNotes: string };
  onSetGradingForm: (_updater: (_current: any) => any) => void;
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
          className="rounded-lg border border-app-border bg-white p-6"
          onSubmit={onHandleGradingUpdate}
        >
          <div className="border-b border-app-border pb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Calificación</p>
            <h4 className="mt-1 text-base font-semibold text-slate-900">
              Consolida la nota oficial
            </h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              La nota vive en la entrega, no en el run del builder. Usa este bloque para cerrar evaluación académica y feedback manual.
            </p>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
            <div>
              <label className="label-text">Nota oficial</label>
              <input
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
              <label className="label-text">Observaciones del corrector</label>
              <textarea
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
            <div className="text-sm text-slate-500">
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
        <div className="rounded-lg border border-app-border bg-white p-6">
          <EmptyState
            icon={<RiAlertLine className="text-3xl text-slate-400" />}
            title="Solo lectura"
            description="Tu rol actual no permite modificar la calificación oficial de esta entrega."
          />
        </div>
      )}
    </section>
  );
}
