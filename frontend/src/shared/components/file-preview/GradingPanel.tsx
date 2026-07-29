/**
 * @fileoverview Componente de previsualización de archivos y código fuente (GradingPanel).
 *
 * @module GradingPanel
 */

import { useState } from "react";
import { RiLoader4Line, RiSave2Line } from "react-icons/ri";
import type { BuildRunEntity } from "../../../features/builder/types";
import type { DeliveryEntity } from "../../../features/deliveries/types";
import { structuralTypeLabel } from "../../data/builderTaxonomy";
import { Button } from "../ui/Button";

interface GradingPanelProps {
  delivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  initialGrade: string;
  initialNotes: string;
  onSubmitGrading: (grade: string, graderNotes: string) => Promise<void>;
}

export function GradingPanel({
  delivery,
  reportRun,
  initialGrade,
  initialNotes,
  onSubmitGrading,
}: GradingPanelProps): JSX.Element {
  const [grade, setGrade] = useState(initialGrade);
  const [graderNotes, setGraderNotes] = useState(initialNotes);
  const [isSaving, setIsSaving] = useState(false);

  const assessment = reportRun?.llmAssessment;

  const handleSaveGrading = async () => {
    setIsSaving(true);
    try {
      await onSubmitGrading(grade, graderNotes);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex w-[480px] flex-col overflow-hidden border-l border-app-border bg-white">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {assessment ? (
          <article className="rounded-lg border border-warning-200 bg-warning-50/30 p-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-warning-800">
              Dictamen de la Inteligencia Artificial
            </div>
            <h4 className="text-base font-bold text-slate-900">
              {structuralTypeLabel(assessment.structuralType)}
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {assessment.rationale}
            </p>
          </article>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveGrading();
          }}
          className="space-y-4"
        >
          <div className="border-b border-app-border pb-3">
            <h4 className="text-base font-bold text-accent">
              Nota Oficial y Feedback
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              Consolida la nota oficial para el expediente del estudiante.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="ui-label" htmlFor="grading-grade">
                Nota (0-10)
              </label>
              <input
                id="grading-grade"
                type="number"
                min="0"
                max="10"
                step="0.01"
                className="input-field text-center text-lg font-bold"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              {/* Etiqueta de un valor de solo lectura, no de un control. */}
              <span className="ui-label">Estado de la Entrega</span>
              <div className="flex h-11 items-center rounded-md border border-app-border bg-slate-50/50 px-3 text-xs font-bold text-slate-500">
                {delivery.status}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="ui-label" htmlFor="grading-notes">
              Observaciones del Evaluador
            </label>
            <textarea
              id="grading-notes"
              className="input-field min-h-[120px] text-xs"
              value={graderNotes}
              onChange={(event) => setGraderNotes(event.target.value)}
              placeholder="Escribe comentarios de corrección, rúbricas aplicadas o avisos manuales..."
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="flex w-full items-center justify-center gap-2"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <RiLoader4Line className="animate-spin text-lg motion-reduce:animate-none" />
                Guardando...
              </>
            ) : (
              <>
                <RiSave2Line className="text-lg" />
                Guardar Calificación Oficial
              </>
            )}
          </Button>
        </form>
      </div>
    </section>
  );
}
