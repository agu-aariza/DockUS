/**
 * @fileoverview Componente compartido de la interfaz EduCodeAI (TeacherGradingStudio).
 *
 * @module TeacherGradingStudio
 */

import { RiAwardFill, RiCloseLine } from "react-icons/ri";
import type { BuildRunEntity } from "../../features/builder/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import { evaluativeStateLabel } from "../data/builderTaxonomy";
import { CodeViewer } from "./file-preview/CodeViewer";
import { FileExplorer } from "./file-preview/FileExplorer";
import { FilePreviewShell } from "./file-preview/FilePreviewShell";
import { GradingPanel } from "./file-preview/GradingPanel";
import { useFilePreview, type PreviewFile } from "./file-preview/useFilePreview";

interface TeacherGradingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  delivery: DeliveryEntity;
  reportRun: BuildRunEntity | null;
  files: PreviewFile[];
  isLoadingFiles: boolean;
  onSubmitGrading: (grade: string, graderNotes: string) => Promise<void>;
  initialGrade: string;
  initialNotes: string;
}

/** Light-themed grading workspace: the same file explorer plus the official grading form. */
export function TeacherGradingStudio({
  isOpen,
  onClose,
  delivery,
  reportRun,
  files,
  isLoadingFiles,
  onSubmitGrading,
  initialGrade,
  initialNotes,
}: TeacherGradingStudioProps) {
  const preview = useFilePreview(files);

  if (!isOpen) return null;

  const assessment = reportRun?.llmAssessment;

  const header = (
    <header className="flex items-center justify-between border-b border-app-border bg-white px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle text-accent">
          <RiAwardFill className="text-2xl" />
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-accent">
            Estudio de Calificación Docente
          </h3>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            v{delivery.version} · {delivery.studentName} ({delivery.studentEmail})
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {assessment ? (
          <div className="hidden items-center gap-3 rounded-lg border border-warning-200 bg-warning-50/50 px-4 py-1 lg:flex">
            <span className="text-xs font-bold text-warning-700">
              Nota IA: {assessment.recommendedGrade?.toFixed(2) ?? "N/A"}
            </span>
            <div className="h-3 w-px bg-warning-300" />
            <span className="text-xs font-bold text-warning-800">
              Estado: {evaluativeStateLabel(assessment.evaluativeState, "sin estado")}
            </span>
          </div>
        ) : null}

        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-white text-slate-500 transition-all hover:bg-rose-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50"
        >
          <RiCloseLine className="text-2xl transition-colors" />
        </button>
      </div>
    </header>
  );

  return (
    <FilePreviewShell
      theme="light"
      header={header}
      ariaLabel={`Estudio de calificación docente — v${delivery.version} · ${delivery.studentName}`}
    >
      <section className="flex flex-1 overflow-hidden border-r border-app-border bg-white">
        <FileExplorer
          theme="light"
          files={files}
          filteredFiles={preview.filteredFiles}
          selectedFileIdx={preview.selectedFileIdx}
          onSelectFile={preview.selectFile}
          searchQuery={preview.searchQuery}
          onSearchChange={preview.setSearchQuery}
          isLoading={isLoadingFiles}
        />
        <CodeViewer
          theme="light"
          selectedFile={preview.selectedFile}
          lineNumbers={preview.lineNumbers}
          copied={preview.copied}
          onCopy={preview.handleCopy}
          onDownload={preview.handleDownload}
        />
      </section>

      <GradingPanel
        delivery={delivery}
        reportRun={reportRun}
        initialGrade={initialGrade}
        initialNotes={initialNotes}
        onSubmitGrading={onSubmitGrading}
      />
    </FilePreviewShell>
  );
}
