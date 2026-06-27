import { RiAlertLine, RiArrowLeftLine, RiArrowRightLine, RiFileZipLine } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { FileTreePreview } from "./FileTreePreview";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

const FILE_INPUT_ID = "student-submission-file";

export function SubmissionStep2({ flow }: Props) {
  const {
    step,
    setStep,
    file,
    fileSizeError,
    isDragging,
    previewFiles,
    previewLoading,
    previewError,
    previousPreviewError,
    activeAssignment,
    previewValidation,
    shouldWarnBeforeContinue,
    handleFileSelection,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleNextStep,
  } = flow;

  if (step !== 2) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-slate-400">Paso 2 · Archivo</div>
        <h3 className="mt-2 text-3xl font-semibold text-slate-900">
          Adjunta el codigo de la nueva version
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Sube un archivo comprimido en formato <code>.zip</code> o <code>.tar.gz</code> con el contenido de{" "}
          <strong>{activeAssignment?.projectTitle}</strong>.
        </p>
      </div>

      <label
        htmlFor={FILE_INPUT_ID}
        className="text-sm font-semibold text-slate-900"
      >
        Archivo comprimido de la practica
      </label>

      <div
        className={`relative rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all ${
          isDragging
            ? "border-primary bg-primary/5 shadow-inner"
            : "border-app-border bg-slate-50 hover:border-primary/40 hover:bg-primary/5"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          id={FILE_INPUT_ID}
          type="file"
          accept=".zip,.tar,.gz,.tgz"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-describedby={`${FILE_INPUT_ID}-hint`}
          onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
        />
        <RiFileZipLine className="mx-auto text-5xl text-primary/60" />
        {file ? (
          <div className="mt-4">
            <div className="text-lg font-semibold text-slate-900">
              {file.name}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-lg font-semibold text-slate-900">
              {isDragging
                ? "Suelta el archivo aqui"
                : "Haz clic o arrastra el archivo a esta zona"}
            </div>
            <div
              id={`${FILE_INPUT_ID}-hint`}
              className="mt-2 text-sm text-slate-500"
            >
              Maximo 50 MB · Formatos admitidos: .zip, .tar.gz
            </div>
          </div>
        )}
      </div>

      {fileSizeError ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          <RiAlertLine className="shrink-0 text-base" />
          El archivo no puede superar los 50 MB. Selecciona uno mas ligero antes de continuar.
        </div>
      ) : null}

      {previewLoading ? (
        <div className="rounded-lg border border-app-border bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Analizando la estructura del archivo para mostrar la vista previa...
        </div>
      ) : null}

      {previewError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {previewError}
        </div>
      ) : null}

      {file && previewFiles.length > 0 ? (
        <FileTreePreview
          files={previewFiles}
          diff={previewValidation.diff}
          totalSizeBytes={previewValidation.totalSizeBytes}
        />
      ) : null}

      {previousPreviewError ? (
        <div className="rounded-lg border border-app-border/30 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          No pudimos comparar esta version con la entrega anterior: {previousPreviewError}
        </div>
      ) : null}

      {shouldWarnBeforeContinue ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
          <div className="font-semibold">
            Detectamos senales que conviene revisar antes de seguir
          </div>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            {previewValidation.warnings.map((warning) => (
              <li key={warning.code}>{warning.message}</li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" onClick={handleNextStep}>
              Continuar igualmente
            </Button>
            <Button variant="secondary" onClick={() => handleFileSelection(null)}>
              Elegir otro archivo
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-app-border pt-4 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={() => setStep(1)}>
          <RiArrowLeftLine />
          Volver
        </Button>
        <Button
          variant="primary"
          disabled={!file || previewLoading}
          onClick={handleNextStep}
        >
          Continuar
          <RiArrowRightLine />
        </Button>
      </div>
    </div>
  );
}
