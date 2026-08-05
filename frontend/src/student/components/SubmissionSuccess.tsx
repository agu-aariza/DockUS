/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionSuccess).
 *
 * @module SubmissionSuccess
 */

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
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";
import type { StudentTab } from "../studentTabs";

interface Props {
  flow: SubmissionFlowState;
  onNavigate: (tab: StudentTab) => void;
}

export function SubmissionSuccess({ flow, onNavigate }: Props) {
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
      <StudentSurface tone="accent" className="motion-rise-in">
        <StudentSurfaceHeader
          eyebrow="Entrega registrada"
          title={`Versión v${createdVersion ?? "?"} enviada correctamente`}
          description={`Tu archivo ${file?.name ?? ""} ya forma parte del historial de la práctica. Ahora puedes dejar lanzada la evaluación técnica o volver al workspace para seguirla después.`}
          badge={
            <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success-subtle px-3 py-1 text-xs font-semibold text-success-700 dark:text-success-400">
              <RiCheckboxCircleLine aria-hidden="true" />
              Entrega confirmada
            </span>
          }
        />
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="Práctica"
            value={activeAssignment?.projectTitle ?? "Proyecto"}
            helper="Contexto activo"
            icon={<RiFolderOpenLine />}
            variant="default"
          />
          <MetricCard
            label="Versión"
            value={`v${createdVersion ?? "?"}`}
            helper="Nueva entrega registrada"
            icon={<RiUploadCloud2Line />}
            variant="success"
          />
          <MetricCard
            label="Intentos restantes"
            value={Math.max(0, (activeAssignment?.remainingDeliveries ?? 1) - 1)}
            helper="Después de esta subida"
            icon={<RiInboxArchiveLine />}
            variant="info"
          />
        </div>
      </StudentSurface>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
        <StudentSurface>
          <StudentSurfaceHeader
            eyebrow="Siguiente decisión"
            title="¿Quieres lanzar la evaluación automática ahora?"
            description="Si la ejecutas ahora, EduCodeAI analizará el código, intentará construirlo y te devolverá un informe técnico con evidencia y coaching para la siguiente versión."
          />

          {buildLaunched ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-success-200 bg-success-50 p-5 dark:border-success-800 dark:bg-success-950">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-app-surface text-success-600 shadow-sm dark:text-success-400">
                    <RiCheckboxCircleLine className="text-xl" />
                  </div>
                  <div>
                    <div className="font-semibold text-success-900 dark:text-success-300">
                      Evaluación ya lanzada
                    </div>
                    <p className="mt-2 text-sm leading-6 text-success-800 dark:text-success-400">
                      El run técnico ya está en marcha. Puedes seguirlo desde informes o volver al resumen para esperar el resultado.
                    </p>
                  </div>
                </div>
              </div>
              {createdRun ? (
                <EvaluationProgressCard
                  run={createdRun}
                  historicalMedianMs={historicalMedianMs}
                  onOpenReport={() => onNavigate("informes")}
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-app-border bg-app-bg-subtle p-5 text-sm leading-6 text-app-text-secondary">
                Lanzar el builder ahora te ahorra contexto perdido: el siguiente
                informe quedará asociado a esta versión y podrás usarlo para reenviar
                con criterio si aún te quedan intentos.
              </div>

              {buildError ? (
                <div className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger-800 dark:text-danger-300">
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
                      <RiLoader4Line className="animate-spin motion-reduce:animate-none" />
                      Lanzando evaluación
                    </>
                  ) : (
                    <>
                      <RiRocketLine />
                      Evaluar ahora
                    </>
                  )}
                </Button>
                <Button variant="secondary" onClick={() => onNavigate("informes")}>
                  Seguir después
                </Button>
              </div>
            </div>
          )}
        </StudentSurface>

        <StudentSurface tone="subtle">
          <StudentSurfaceHeader
            eyebrow="Navegación rápida"
            title="Sigue trabajando desde el workspace"
            description="Ya no necesitas rehacer el contexto: la práctica, la versión y el historial quedan enlazados para las siguientes superficies."
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
            <Button variant="primary" onClick={() => onNavigate("summary")}>
              Ir al resumen
            </Button>
          </div>
        </StudentSurface>
      </div>
    </div>
  );
}
