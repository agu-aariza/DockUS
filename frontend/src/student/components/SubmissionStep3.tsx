/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionStep3).
 *
 * @module SubmissionStep3
 */

import { RiArrowLeftLine, RiLoader4Line, RiUploadCloud2Line } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { formatBytes } from "../../shared/utils/format";
import { StudentKeyValueList } from "./StudentWorkspaceSurface";
import { formatAssignmentDate } from "../deadlineUtils";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

export function SubmissionStep3({ flow }: Props) {
  const {
    step,
    setStep,
    file,
    status,
    activeAssignment,
    previewFiles,
    previewValidation,
    afterDeadline,
    handleSubmit,
  } = flow;

  if (step !== 3) {
    return null;
  }

  const isUploading = status === "uploading";

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Paso 3 · Confirmación</div>
        <h3 className="mt-2 font-display text-3xl leading-tight text-app-text">
          Revisa el envío antes de registrarlo
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-secondary">
          Esta confirmación cierra el asistente y registra la versión en el
          historial de la práctica.
        </p>
      </div>

      <div className="rounded-lg border border-app-border bg-app-bg-subtle p-5">
        <StudentKeyValueList
          items={[
            {
              label: "Práctica",
              value: activeAssignment?.projectTitle ?? "Sin práctica",
            },
            { label: "Archivo", value: file?.name ?? "Sin archivo" },
            {
              label: "Ventana",
              value: `${formatAssignmentDate(activeAssignment?.opensAt)} → ${formatAssignmentDate(activeAssignment?.closesAt)}`,
            },
            {
              label: "Tamaño",
              value: file ? formatBytes(file.size) : "Sin archivo",
            },
            {
              label: "Intentos después del envío",
              value: String(
                Math.max(0, (activeAssignment?.remainingDeliveries ?? 1) - 1),
              ),
            },
          ]}
        />
      </div>

      {previewFiles.length > 0 ? (
        <div className="rounded-lg border border-app-border/30 bg-app-surface px-4 py-4 text-sm text-app-text-muted">
          <div className="font-bold text-app-text">
            Resumen de la comparación con tu última versión
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-semibold text-success-700 dark:border-success-800 dark:bg-success-950 dark:text-success-400">
              +{previewValidation.diff.added.length} añadidos
            </span>
            <span className="rounded-full border border-warning-200 bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 dark:border-warning-800 dark:bg-warning-950 dark:text-warning-400">
              {previewValidation.diff.persisted.length} persistentes
            </span>
            <span className="rounded-full border border-danger/30 bg-danger-subtle px-3 py-1 text-xs font-semibold text-danger-700 dark:text-danger-400">
              -{previewValidation.diff.removed.length} eliminados
            </span>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-6 text-primary">
        Tras enviar esta versión, podrás lanzar el builder en el mismo flujo
        para obtener evaluación técnica y coaching de remediación.
      </div>

      {afterDeadline ? (
        <div
          className="motion-rise-in rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm leading-6 text-warning-900 dark:text-warning-300"
          role="alert"
        >
          La fecha de cierre ya pasó. La entrega quedará marcada como fuera
          de plazo, aunque seguirá registrada y evaluable.
        </div>
      ) : null}

      {isUploading ? (
        <div
          className="motion-rise-in rounded-lg border border-primary/20 bg-primary-subtle px-4 py-4"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3 text-sm font-semibold text-primary">
            <RiLoader4Line
              className="shrink-0 animate-spin text-base motion-reduce:animate-none"
              aria-hidden="true"
            />
            Subiendo tu entrega y encolando la evaluación...
          </div>
          <p className="mt-1 pl-7 text-xs leading-5 text-app-text-secondary">
            No cierres esta ventana. En cuanto se registre, verás el progreso de
            la evaluación en vivo.
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/15">
            <div className="progress-indeterminate h-full w-1/4 rounded-full bg-primary" />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-app-border pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          disabled={isUploading}
          onClick={() => setStep(2)}
        >
          <RiArrowLeftLine aria-hidden="true" />
          Volver
        </Button>
        <Button
          variant="primary"
          disabled={isUploading}
          onClick={handleSubmit}
        >
          {isUploading ? (
            <>
              <RiLoader4Line
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              Enviando...
            </>
          ) : status === "error" ? (
            <>
              <RiUploadCloud2Line aria-hidden="true" />
              Reintentar subida
            </>
          ) : (
            <>
              <RiUploadCloud2Line aria-hidden="true" />
              Enviar ahora
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
