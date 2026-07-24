/**
 * @fileoverview Componente de UI del espacio de trabajo del estudiante (SubmissionSidebar).
 *
 * @module SubmissionSidebar
 */

import { formatAssignmentDate } from "../deadlineUtils";
import { StudentKeyValueList, StudentSurface, StudentSurfaceHeader } from "./StudentWorkspaceSurface";
import { SubmissionCoachingPreview } from "../SubmissionCoachingPreview";
import type { SubmissionFlowState } from "../hooks/useSubmissionFlow";

interface Props {
  flow: SubmissionFlowState;
}

export function SubmissionSidebar({ flow }: Props) {
  const {
    activeAssignment,
    activeTimeline,
    workflow,
    latestAssignmentDelivery,
    noRemainingDeliveries,
    notYetOpen,
    afterDeadline,
    latestAssignmentRun,
  } = flow;

  return (
    <div className="space-y-6">
      {activeAssignment && activeTimeline ? (
        <StudentSurface
          tone={
            activeTimeline.state === "late"
              ? "warm"
              : activeTimeline.state === "upcoming"
                ? "subtle"
                : "default"
          }
        >
          <StudentSurfaceHeader
            eyebrow="Ventana de entrega"
            title={activeTimeline.headline}
            description={activeTimeline.detail}
            badge={
              activeTimeline.countdownLabel ? (
                <span className="inline-flex rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-900">
                  {activeTimeline.countdownLabel}
                </span>
              ) : undefined
            }
          />
        </StudentSurface>
      ) : null}

      <StudentSurface>
        <StudentSurfaceHeader
          eyebrow="Briefing de la practica"
          title={activeAssignment?.projectTitle ?? "Selecciona una práctica"}
          description="Antes de subir nada, confirma que esta es la convocatoria correcta y revisa si conviene reenviar ahora o esperar otro momento."
          badge={
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${workflow.badgeClassName}`}
            >
              {workflow.label}
            </span>
          }
        />
        <StudentKeyValueList
          className="mt-6"
          items={[
            {
              label: "Apertura",
              value: formatAssignmentDate(activeAssignment?.opensAt),
            },
            {
              label: "Cierre",
              value: formatAssignmentDate(activeAssignment?.closesAt),
            },
            {
              label: "Ultima entrega",
              value: latestAssignmentDelivery
                ? `v${latestAssignmentDelivery.version}`
                : "Aun no hay entregas",
            },
            {
              label: "Siguiente foco",
              value: noRemainingDeliveries
                ? "Ya no quedan intentos disponibles"
                : notYetOpen
                  ? "Esperar a que se abra la ventana"
                  : "Preparar archivo y confirmar subida",
            },
          ]}
        />

        {(noRemainingDeliveries || notYetOpen || afterDeadline) && activeAssignment ? (
          <div className="mt-6 rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm leading-6 text-warning-900">
            {noRemainingDeliveries
              ? "Esta práctica ya no tiene intentos restantes. Puedes seguir revisando el informe y el historial, pero no se habilitará otra subida."
              : notYetOpen
                ? "La convocatoria sigue cerrada. En cuanto se abra, podrás continuar con el asistente de subida."
                : "La fecha de cierre ya pasó. Puedes seguir entregando, pero esta versión quedará marcada como fuera de plazo."}
          </div>
        ) : null}
      </StudentSurface>

      {latestAssignmentRun?.report?.coaching ? (
        <SubmissionCoachingPreview
          run={latestAssignmentRun}
          remainingDeliveries={activeAssignment?.remainingDeliveries ?? 0}
        />
      ) : null}
    </div>
  );
}
