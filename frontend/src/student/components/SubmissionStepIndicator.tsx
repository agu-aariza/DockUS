import { RiCheckLine } from "react-icons/ri";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

function getStepState(
  currentStep: number,
  targetStep: number,
): "complete" | "active" | "idle" {
  if (currentStep > targetStep) {
    return "complete";
  }
  if (currentStep === targetStep) {
    return "active";
  }
  return "idle";
}

export function SubmissionStepIndicator({ flow }: Props) {
  const { step } = flow;

  return (
    <div className="border-b border-app-border bg-slate-50 px-6 py-5 sm:px-8">
      <div className="flex flex-wrap items-center gap-4">
        {[
          { number: 1, label: "Practica" },
          { number: 2, label: "Archivo" },
          { number: 3, label: "Confirmar" },
        ].map((item) => {
          const stepState = getStepState(step, item.number);

          return (
            <div key={item.number} className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                  stepState === "complete"
                    ? "bg-emerald-500 text-white"
                    : stepState === "active"
                      ? "bg-primary text-white"
                      : "bg-white text-slate-400"
                }`}
              >
                {stepState === "complete" ? <RiCheckLine /> : item.number}
              </div>
              <div>
                <div className="ui-label text-slate-400">
                  Paso {item.number}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {item.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
