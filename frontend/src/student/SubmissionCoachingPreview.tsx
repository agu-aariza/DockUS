import type { BuildRunEntity } from "../shared/types";
import { CoachingSummary } from "../shared/components/CoachingSummary";

interface SubmissionCoachingPreviewProps {
  run: BuildRunEntity;
  remainingDeliveries: number;
}

export function SubmissionCoachingPreview({
  run,
  remainingDeliveries,
}: SubmissionCoachingPreviewProps): JSX.Element | null {
  const coaching = run.report?.coaching;
  if (!coaching) {
    return null;
  }

  return (
    <div className="space-y-3">
      <CoachingSummary
        coaching={coaching}
        variant="compact"
        runtimeFamily={run.llmAssessment?.runtime?.family}
      />
      {remainingDeliveries <= 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Ya no quedan intentos para reenviar esta practica, pero puedes usar
          este resumen para entender que habria que corregir.
        </div>
      ) : null}
    </div>
  );
}
