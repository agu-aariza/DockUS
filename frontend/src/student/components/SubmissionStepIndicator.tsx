/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionStepIndicator).
 *
 * @module SubmissionStepIndicator
 */

import { RiCheckLine } from "react-icons/ri";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

type StepState = "complete" | "active" | "idle";

const STEPS = [
  { number: 1, label: "Práctica" },
  { number: 2, label: "Archivo" },
  { number: 3, label: "Confirmar" },
] as const;

function getStepState(currentStep: number, targetStep: number): StepState {
  if (currentStep > targetStep) {
    return "complete";
  }
  if (currentStep === targetStep) {
    return "active";
  }
  return "idle";
}

const BUBBLE_STATE: Record<StepState, string> = {
  complete: "bg-success text-white ring-4 ring-success/10",
  active: "bg-primary text-white ring-4 ring-primary/15 status-pulse status-pulse-primary",
  idle: "border border-app-border bg-white text-slate-400",
};

export function SubmissionStepIndicator({ flow }: Props) {
  const { step } = flow;

  return (
    // Sin `sticky`: el banner de notificaciones ya ocupa `top-0` y taparía el indicador.
    <div className="border-b border-app-border bg-slate-50 px-5 py-5 sm:px-8">
      <ol className="flex items-center gap-2 sm:gap-4">
        {STEPS.map((item, index) => {
          const stepState = getStepState(step, item.number);
          const isLast = index === STEPS.length - 1;

          return (
            <li
              key={item.number}
              className="flex flex-1 items-center gap-3 last:flex-none"
              aria-current={stepState === "active" ? "step" : undefined}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${BUBBLE_STATE[stepState]}`}
              >
                {stepState === "complete" ? (
                  <RiCheckLine aria-hidden="true" />
                ) : (
                  item.number
                )}
              </div>

              <div className="min-w-0">
                <div className="ui-label text-slate-400">Paso {item.number}</div>
                <div
                  className={`truncate text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ${
                    stepState === "idle" ? "text-slate-400" : "text-slate-900"
                  }`}
                >
                  {item.label}
                </div>
                <span className="sr-only">
                  {stepState === "complete"
                    ? "completado"
                    : stepState === "active"
                      ? "en curso"
                      : "pendiente"}
                </span>
              </div>

              {!isLast ? (
                <div
                  aria-hidden="true"
                  className="ml-1 hidden h-0.5 flex-1 overflow-hidden rounded-full bg-app-border sm:block"
                >
                  <div
                    className={`h-full rounded-full bg-success transition-[width] duration-500 ease-out motion-reduce:transition-none ${
                      step > item.number ? "w-full" : "w-0"
                    }`}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
