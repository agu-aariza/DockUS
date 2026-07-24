/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionStep1).
 *
 * @module SubmissionStep1
 */

import { RiArrowRightLine, RiBookOpenLine, RiFolderOpenLine } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { formatAssignmentDate, describeAssignmentTimeline } from "../deadlineUtils";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

export function SubmissionStep1({ flow }: Props) {
  const {
    step,
    assignments,
    selectedAssignmentId,
    setSelectedAssignmentId,
    activeAssignment,
    canContinueFromStep1,
    handleNextStep,
    now,
  } = flow;

  if (step !== 1) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-slate-400">Paso 1 · Convocatoria</div>
        <h3 className="mt-2 text-3xl font-semibold text-slate-900">
          Elige la practica que vas a entregar
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          El asistente se queda con la practica seleccionada para reutilizar
          el contexto en entregas, informes y coaching.
        </p>
      </div>

      <div className="grid gap-3">
        {assignments.map((assignment) => {
          const assignmentTimeline = describeAssignmentTimeline(assignment, now);
          const disabled =
            assignment.remainingDeliveries <= 0 ||
            Boolean(assignment.opensAt && new Date(assignment.opensAt).getTime() > now);

          return (
            <label
              key={assignment.id}
              className={`flex cursor-pointer items-start gap-4 rounded-lg border p-5 shadow-sm focus-within:ring-2 focus-within:ring-primary/40 ${
                disabled
                  ? "cursor-not-allowed border-app-border/30 bg-slate-50/20 opacity-70 shadow-none"
                  : selectedAssignmentId === assignment.id
                    ? "border-primary bg-primary-subtle ring-1 ring-primary/20"
                    : "card-interactive border-app-border bg-white"
              }`}
            >
              <input
                type="radio"
                name="assignment"
                value={assignment.id}
                checked={selectedAssignmentId === assignment.id}
                disabled={disabled}
                onChange={() => setSelectedAssignmentId(assignment.id)}
                className="mt-1 h-4 w-4 text-primary focus:ring-primary"
              />
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none ${
                  selectedAssignmentId === assignment.id
                    ? "bg-primary text-white"
                    : "bg-slate-50 text-primary"
                }`}
              >
                <RiFolderOpenLine className="text-xl" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">
                    {assignment.projectTitle}
                  </div>
                  <span className="inline-flex rounded-full border border-app-border bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase text-slate-500">
                    {assignmentTimeline.headline}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {assignmentTimeline.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full border border-app-border px-2.5 py-1">
                    {assignment.remainingDeliveries} intento(s) disponibles
                  </span>
                  <span className="rounded-full border border-app-border px-2.5 py-1">
                    Abre {formatAssignmentDate(assignment.opensAt)}
                  </span>
                  <span className="rounded-full border border-app-border px-2.5 py-1">
                    Cierra {formatAssignmentDate(assignment.closesAt)}
                  </span>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {activeAssignment?.rubricInstructions ? (
        <details className="group rounded-lg border border-app-border bg-slate-50">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 text-sm font-semibold text-slate-900 select-none">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <RiBookOpenLine className="text-base" />
            </div>
            <span className="flex-1">¿Qué se evaluará? Ver criterios de la rúbrica</span>
            <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="border-t border-app-border px-5 pb-5 pt-4">
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-500">
              {activeAssignment.rubricInstructions}
            </p>
          </div>
        </details>
      ) : null}

      <div className="flex justify-end pt-2">
        <Button variant="primary" disabled={!canContinueFromStep1} onClick={handleNextStep}>
          Continuar
          <RiArrowRightLine />
        </Button>
      </div>
    </div>
  );
}
