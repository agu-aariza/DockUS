import { RiArrowLeftLine, RiLoader4Line, RiUploadCloud2Line } from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
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

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow text-slate-400">Paso 3 · Confirmación</div>
        <h3 className="mt-2 text-3xl font-semibold text-slate-900">
          Revisa el envío antes de registrarlo
        </h3>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
          Esta confirmación cierra el asistente y registra la versión en el
          historial de la práctica.
        </p>
      </div>

      <div className="rounded-lg border border-app-border bg-slate-50 p-5">
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
              value: file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                : "Sin archivo",
            },
            {
              label: "Intentos despues del envio",
              value: String(
                Math.max(0, (activeAssignment?.remainingDeliveries ?? 1) - 1),
              ),
            },
          ]}
        />
      </div>

      {previewFiles.length > 0 ? (
        <div className="rounded-lg border border-app-border/30 bg-white px-4 py-4 text-sm text-slate-500">
          <div className="font-bold text-slate-900">
            Resumen de la comparación con tu última versión
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              +{previewValidation.diff.added.length} añadidos
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {previewValidation.diff.persisted.length} persistentes
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          La fecha de cierre ya pasó. La entrega quedará marcada como fuera
          de plazo, aunque seguirá registrada y evaluable.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-app-border pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          disabled={status === "uploading"}
          onClick={() => setStep(2)}
        >
          <RiArrowLeftLine />
          Volver
        </Button>
        <Button
          variant="primary"
          disabled={status === "uploading"}
          onClick={handleSubmit}
        >
          {status === "uploading" ? (
            <>
              <RiLoader4Line className="animate-spin" />
              Enviando
            </>
          ) : (
            <>
              <RiUploadCloud2Line />
              Enviar ahora
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
