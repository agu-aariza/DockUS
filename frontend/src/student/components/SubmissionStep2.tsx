/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionStep2).
 *
 * @module SubmissionStep2
 */

import { useRef } from "react";
import {
  RiAlertLine,
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckboxCircleFill,
  RiFileZipLine,
  RiLoader4Line,
} from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { formatBytes } from "../../shared/utils/format";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDropZoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  };

  if (step !== 2) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Paso 2 · Archivo</div>
        <h3 className="mt-2 font-display text-3xl leading-tight text-app-text">
          Adjunta el código de la nueva versión
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-secondary">
          Sube un archivo comprimido en formato <code>.zip</code> o <code>.tar.gz</code> con el contenido de{" "}
          <strong>{activeAssignment?.projectTitle}</strong>.
        </p>
      </div>

      <label
        htmlFor={FILE_INPUT_ID}
        className="text-sm font-semibold text-app-text"
      >
        Archivo comprimido de la práctica
      </label>

      <div
        tabIndex={0}
        role="button"
        aria-label="Arrastra o selecciona un archivo"
        className={`relative rounded-lg border-2 border-dashed px-6 py-10 text-center transition-[border-color,background-color,transform,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none ${
          isDragging
            ? "scale-[1.01] border-primary bg-primary-subtle shadow-md"
            : file
              ? "border-success/50 bg-success-subtle"
              : "border-app-border bg-app-bg-subtle hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-subtle hover:shadow-sm"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleDropZoneKeyDown}
      >
        <input
          ref={fileInputRef}
          id={FILE_INPUT_ID}
          type="file"
          accept=".zip,.tar,.gz,.tgz"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-describedby={`${FILE_INPUT_ID}-hint`}
          onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <RiCheckboxCircleFill
            className="mx-auto text-5xl text-success"
            aria-hidden="true"
          />
        ) : (
          <RiFileZipLine
            className={`mx-auto text-5xl transition-transform duration-200 motion-reduce:transition-none ${
              isDragging ? "-translate-y-1 text-primary" : "text-primary/60"
            }`}
            aria-hidden="true"
          />
        )}
        <div className="mt-4">
          {file ? (
            <>
              <div className="break-all text-lg font-semibold text-app-text">
                {file.name}
              </div>
              <div className="mt-1 text-sm text-app-text-secondary">
                {formatBytes(file.size)} · listo para revisar
              </div>
              <div className="mt-2 text-xs text-app-text-muted">
                Haz clic de nuevo para elegir otro archivo
              </div>
            </>
          ) : (
            <div className="text-lg font-semibold text-app-text">
              {isDragging
                ? "Suelta el archivo aquí"
                : "Haz clic o arrastra el archivo a esta zona"}
            </div>
          )}

          {/* Siempre presente: el input lo referencia con aria-describedby. */}
          <div
            id={`${FILE_INPUT_ID}-hint`}
            className={`text-sm text-app-text-muted ${file ? "sr-only" : "mt-2"}`}
          >
            Máximo 50 MB · Formatos admitidos: .zip, .tar.gz
          </div>
        </div>
      </div>

      {fileSizeError ? (
        <div
          className="motion-rise-in flex items-center gap-2 rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger-800 dark:text-danger-300"
          role="alert"
        >
          <RiAlertLine className="shrink-0 text-base" aria-hidden="true" />
          El archivo no puede superar los 50 MB. Selecciona uno más ligero antes de continuar.
        </div>
      ) : null}

      {previewLoading ? (
        <div
          className="flex items-center gap-3 rounded-lg border border-app-border bg-app-bg-subtle px-4 py-3 text-sm text-app-text-secondary"
          aria-busy="true"
          aria-live="polite"
        >
          <RiLoader4Line
            className="shrink-0 animate-spin text-base text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          Analizando la estructura del archivo para mostrar la vista previa...
        </div>
      ) : null}

      {previewError ? (
        <div
          className="motion-rise-in rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-900 dark:text-warning-300"
          role="alert"
        >
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
        <div className="rounded-lg border border-app-border/30 bg-app-bg-subtle px-4 py-3 text-sm text-app-text-muted">
          No pudimos comparar esta versión con la entrega anterior: {previousPreviewError}
        </div>
      ) : null}

      {shouldWarnBeforeContinue ? (
        <div className="motion-rise-in rounded-lg border border-warning/30 bg-warning-subtle px-4 py-4 text-sm text-warning-900 dark:text-warning-300">
          <div className="font-semibold">
            Detectamos señales que conviene revisar antes de seguir
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
          {previewLoading ? (
            <>
              <RiLoader4Line
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Analizando...
            </>
          ) : (
            <>
              Continuar
              <RiArrowRightLine aria-hidden="true" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
