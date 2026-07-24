/**
 * @fileoverview Panel y vista del espacio del alumno (StudentSubmissionFlow).
 *
 * @module StudentSubmissionFlow
 */

import { StudentSurface } from "./components/StudentWorkspaceSurface";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { useSubmissionFlow } from "./hooks/useSubmissionFlow";
import { SubmissionEmptyState } from "./components/SubmissionEmptyState";
import { SubmissionSuccess } from "./components/SubmissionSuccess";
import { SubmissionSidebar } from "./components/SubmissionSidebar";
import { SubmissionStepIndicator } from "./components/SubmissionStepIndicator";
import { SubmissionStep1 } from "./components/SubmissionStep1";
import { SubmissionStep2 } from "./components/SubmissionStep2";
import { SubmissionStep3 } from "./components/SubmissionStep3";
import type { StudentTab } from "./studentTabs";

interface Props {
  data: StudentWorkspaceData;
  onNavigate: (tab: StudentTab) => void;
}

export function StudentSubmissionFlow({
  data,
  onNavigate,
}: Props): JSX.Element {
  const flow = useSubmissionFlow(data);
  const { noAssignments, step, status, errorMessage } = flow;

  if (noAssignments) {
    return <SubmissionEmptyState onNavigate={onNavigate} />;
  }

  if (step === 4) {
    return <SubmissionSuccess flow={flow} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.02fr,1.45fr]">
        <SubmissionSidebar flow={flow} />

        <StudentSurface className="overflow-hidden p-0">
          <SubmissionStepIndicator flow={flow} />

          <div className="p-6 sm:p-8">
            {status === "error" ? (
              <div className="mb-6 rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger-800" role="alert">
                Error al procesar la entrega: {errorMessage}
              </div>
            ) : null}

            <SubmissionStep1 flow={flow} />
            <SubmissionStep2 flow={flow} />
            <SubmissionStep3 flow={flow} />
          </div>
        </StudentSurface>
      </div>
    </div>
  );
}
