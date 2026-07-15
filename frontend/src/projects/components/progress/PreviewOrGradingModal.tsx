import { CodePreviewModal } from "../../../shared/components/CodePreviewModal";
import { TeacherGradingStudio } from "../../../shared/components/TeacherGradingStudio";
import { extractLegacyAiEvidence } from "../../../deliveries/teacherReviewNavigation";
import type { BuildRunEntity } from "../../../features/builder/types";
import type { DeliveryEntity } from "../../../features/deliveries/types";

export interface PreviewFile {
  path: string;
  content: string;
}

interface PreviewOrGradingModalProps {
  isOpen: boolean;
  canWrite: boolean;
  delivery: DeliveryEntity | null;
  reportRun: BuildRunEntity | null;
  files: PreviewFile[];
  isLoadingFiles: boolean;
  onClose: () => void;
  onSubmitGrading: (grade: string, graderNotes: string) => Promise<void>;
}

/**
 * Teachers with write access get the full grading studio; everyone else (and any
 * delivery whose detail has not resolved yet) falls back to the read-only viewer.
 */
export function PreviewOrGradingModal({
  isOpen,
  canWrite,
  delivery,
  reportRun,
  files,
  isLoadingFiles,
  onClose,
  onSubmitGrading,
}: PreviewOrGradingModalProps): JSX.Element {
  if (canWrite && delivery) {
    return (
      <TeacherGradingStudio
        isOpen={isOpen}
        onClose={onClose}
        delivery={delivery}
        reportRun={reportRun}
        files={files}
        isLoadingFiles={isLoadingFiles}
        onSubmitGrading={onSubmitGrading}
        initialGrade={delivery.grade !== null ? String(delivery.grade) : ""}
        initialNotes={
          extractLegacyAiEvidence(delivery.graderNotes).manualNotes ?? ""
        }
      />
    );
  }

  return (
    <CodePreviewModal
      isOpen={isOpen}
      onClose={onClose}
      title="Explorador de Entrega"
      subtitle={
        delivery
          ? `v${delivery.version} — ${delivery.studentName}`
          : "Previsualizando código enviado por el alumno"
      }
      isLoading={isLoadingFiles}
      files={files}
    />
  );
}
