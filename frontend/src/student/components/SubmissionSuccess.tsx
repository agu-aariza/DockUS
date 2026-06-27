import {
  RiCheckboxCircleLine,
  RiFolderOpenLine,
  RiInboxArchiveLine,
  RiLoader4Line,
  RiRocketLine,
  RiUploadCloud2Line,
} from "react-icons/ri";
import { Button } from "../../shared/components/ui/Button";
import { MetricCard } from "../../shared/components/MetricCard";
import { StudentKeyValueList, StudentSurface, StudentSurfaceHeader } from "./StudentWorkspaceSurface";
import { EvaluationProgressCard } from "./EvaluationProgressCard";
import type { SessionRecord } from "../../shared/types";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  session: SessionRecord | null;
  flow: SubmissionFlowState;
  onNavigate: (tab: any) => void;
}

export function SubmissionSuccess({ session, flow, onNavigate }: Props) {
  const {
    createdVersion,
    file,
    activeAssignment,
    buildLaunched,
    createdRun,
    historicalMedianMs,
    buildError,
    buildLaunching,
    handleLaunchBuilder,
  } = flow;

  return (
    <div className="space-y-6">
      <StudentSurface tone="accent">
        <StudentSurfaceHeader
          eyebrow="Entrega registrada"
          title={`Version v${createdVersion ?? "?"} enviada correctamente`}
          description={`Tu archivo ${file?.name ?? ""} ya forma parte del historial de la practica. Ahora puedes dejar lanzada la evaluacion tecnica o volver al workspace para seguirla despues.`}
          badge={
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Entrega confirmada
            </span>
          }
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="Practica"
            value={activeAssignment?.projectTitle ?? "Proyecto"}
            helper="Contexto activo"
            icon={<RiFolderOpenLine />}
            variant="default"
          />
          <MetricCard
            label="Version"
            value={`v${createdVersion ?? "?"}`}
            helper="Nueva entrega registrada"
            icon={<RiUploadCloud2Line />}
            variant="success"
          />
          <MetricCard
            label="Intentos restantes"
            value={Math.max(0, (activeAssignment?.remainingDeliveries ?? 1) - 1)}
            helper="Despues de esta subida"
            icon={<RiInboxArchiveLine />}
            variant="info"
          />
        </div>
      </StudentSurface>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
        <StudentSurface>
          <StudentSurfaceHeader
            eyebrow="Siguiente decision"
            title="Quieres lanzar la evaluacion automatica ahora?"
            description="Si la ejecutas ahora, DockUS analizara el codigo, intentara construirlo y te devolvera un informe tecnico con evidencia y coaching para la siguiente version."
          />

          {buildLaunched ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                    <RiCheckboxCircleLine className="text-xl" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-900">
                      Evaluacion ya lanzada
                    </div>
                    <p className="mt-2 text-sm leading-6 text-emerald-800">
                      El run tecnico ya esta en marcha. Puedes seguirlo desde informes o volver al resumen para esperar el resultado.
                    </p>
                  </div>
                </div>
              </div>
              {createdRun ? (
                <EvaluationProgressCard
                  run={createdRun}
                  session={session}
                  historicalMedianMs={historicalMedianMs}
                  onOpenReport={() => onNavigate("informes")}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-app-border bg-slate-50 p-5 text-sm leading-6 text-slate-500">
                Lanzar el builder ahora te ahorra contexto perdido: el siguiente
                informe quedara asociado a esta version y podras usarlo para reenviar
                con criterio si aun te quedan intentos.
              </div>

              {buildError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {buildError}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  disabled={buildLaunching}
                  onClick={handleLaunchBuilder}
                >
                  {buildLaunching ? (
                    <>
                      <RiLoader4Line className="animate-spin" />
                      Lanzando evaluacion
                    </>
                  ) : (
                    <>
                      <RiRocketLine />
                      Evaluar ahora
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={() => onNavigate("informes")}>
                  Seguir despues
                </Button>
              </div>
            </div>
          )}
        </StudentSurface>

        <StudentSurface tone="subtle">
          <StudentSurfaceHeader
            eyebrow="Navegacion rapida"
            title="Sigue trabajando desde el workspace"
            description="Ya no necesitas rehacer el contexto: la practica, la version y el historial quedan enlazados para las siguientes superficies."
          />
          <StudentKeyValueList
            className="mt-6"
            items={[
              {
                label: "Historial",
                value: "Revisar el registro completo de tus versiones",
              },
              {
                label: "Informes",
                value: buildLaunched
                  ? "Esperar el nuevo informe tecnico"
                  : "Consultar informes anteriores o seguir mas tarde",
              },
              {
                label: "Resumen",
                value: "Volver al command center del alumno",
              },
            ]}
          />
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => onNavigate("entregas")}>
              Ver mis entregas
            </Button>
            <Button variant="primary" onClick={() => onNavigate("resumen")}>
              Ir al resumen
            </Button>
          </div>
        </StudentSurface>
      </div>
    </div>
  );
}
