/**
 * @fileoverview Panel y vista del espacio del alumno (StudentHomeSection).
 *
 * @module StudentHomeSection
 */

import { useState } from "react";
import {
  RiAlertLine,
  RiArrowRightLine,
  RiAwardLine,
  RiBookOpenLine,
  RiFileList3Line,
  RiFolderOpenLine,
  RiInboxArchiveLine,
  RiUploadCloud2Line,
  RiRocketLine,
  RiLoader4Line,
} from "react-icons/ri";
import { builderApi } from "../builder/api/builderApi";

import type { StudentWorkflowState } from "../features/deliveries/types";
import { MetricCard } from "../shared/components/MetricCard";
import { Skeleton } from "../shared/components/Skeleton";
import { Button } from "../shared/components/ui/Button";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { StudentKeyValueList, StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";
import { deriveStudentRetryAction } from "./studentRetryActions";
import { describeAssignmentTimeline } from "./deadlineUtils";
import { PipelineStepper } from "./PipelineStepper";
import { deriveStudentWorkspaceInsights, resolveStudentRunOutcome } from "./studentWorkspaceInsights";
import type { StudentTab } from "./studentTabs";

interface Props {
  data: StudentWorkspaceData;
  onNavigate: (_tab: StudentTab) => void;
}

const HEADLINE_MAP: Record<StudentWorkflowState, string> = {
  NOT_ASSIGNED: "Aún no tienes proyectos",
  WINDOW_NOT_OPEN: "La ventana todavía no ha abierto",
  READY_TO_SUBMIT: "Empieza tu entrega",
  RECEIVED: "Sigue tu entrega",
  QUEUED: "Tu evaluación está en cola",
  RUNNING: "La evaluación está ejecutándose",
  BUILD_FAILED: "Hubo un error en la evaluación",
  REPORT_READY: "Tu informe está listo",
  AWAITING_TEACHER_REVIEW: "Falta la revisión final",
  GRADED: "Tu entrega ya tiene nota",
};

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
}

function formatOutcome(outcome: ReturnType<typeof resolveStudentRunOutcome>): {
  label: string;
  className: string;
} {
  switch (outcome) {
    case "PASS":
      return {
        label: "Apto",
        className:
          "border-success-200 bg-success-50/70 text-success-700 font-semibold dark:border-success-800 dark:bg-success-950/70 dark:text-success-400",
      };
    case "FAIL":
      return {
        label: "No apto",
        className: "border-danger/30 bg-danger-subtle/70 text-danger-700 font-semibold dark:text-danger-400",
      };
    case "PARTIAL":
      return {
        label: "Parcial",
        className: "border-warning-200 bg-warning-50/70 text-warning-700 font-semibold dark:border-warning-800 dark:bg-warning-950/70 dark:text-warning-400",
      };
    case "UNKNOWN":
      return {
        label: "Sin resolver",
        className: "border-app-border/30 bg-app-bg-subtle text-app-text-muted font-semibold",
      };
    default:
      return {
        label: "Sin run",
        className: "border-app-border/20 bg-app-bg-subtle/80 text-app-text-muted/80",
      };
  }
}

function gradeColor(grade: number): string {
  if (grade >= 9) return "text-success-700 dark:text-success-400";
  if (grade >= 5) return "text-success-600 dark:text-success-500";
  return "text-danger-700 dark:text-danger-400";
}

function timelineStyle(state: string): string {
  switch (state) {
    case "late":
      return "border-danger/30 bg-danger-subtle/70 text-danger-700 font-semibold dark:text-danger-400";
    case "upcoming":
      return "border-primary/20 bg-primary/5 text-primary font-semibold";
    default:
      return "border-success-100 bg-success-50/70 text-success-700 font-semibold dark:border-success-800 dark:bg-success-950/70 dark:text-success-400";
  }
}

export function StudentHomeSection({
  data,
  onNavigate,
}: Props): JSX.Element {
  const { selection } = useWorkspaceSelection();
  const [launchingId, setLaunchingId] = useState<string | null>(null);

  const handleLaunchEvaluation = async (deliveryId: string) => {
    setLaunchingId(deliveryId);
    try {
      await builderApi.runForDelivery(deliveryId);
      await data.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLaunchingId(null);
    }
  };
  const {
    assignments,
    deliveries,
    latestDelivery,
    latestRunByDeliveryId,
    loading,
    error,
  } = data;

  const activeAssignment =
    assignments.find((assignment) => assignment.projectId === selection.projectId) ??
    assignments[0] ??
    null;
  const activeDelivery =
    (activeAssignment
      ? deliveries.find((delivery) => delivery.assignmentId === activeAssignment.id)
      : null) ??
    latestDelivery ??
    null;
  const activeRun = activeDelivery
    ? latestRunByDeliveryId[activeDelivery.id] ?? null
    : null;
  const now = Date.now();
  const hasAssignments = assignments.length > 0;

  const workflowState = deriveStudentWorkflowState({
    assignment: activeAssignment,
    delivery: activeDelivery,
    latestRun: activeRun,
    now,
  });
  const workflow = describeStudentWorkflowState(workflowState, {
    isLate: activeDelivery?.isLate,
    projectTitle: activeAssignment?.projectTitle ?? activeDelivery?.projectTitle,
  });
  const retryAction = deriveStudentRetryAction(activeDelivery, activeRun);
  const activeTimeline = activeAssignment
    ? describeAssignmentTimeline(activeAssignment, now)
    : null;
  const insights = deriveStudentWorkspaceInsights(
    assignments,
    deliveries,
    latestRunByDeliveryId,
  );
  const latestOutcome = formatOutcome(resolveStudentRunOutcome(activeRun));
  const latestGrade = deliveries.find((delivery) => delivery.grade !== null)?.grade ?? null;

  if (loading) {
    return (
      <div
        className="grid gap-6 lg:grid-cols-[1.55fr,0.95fr]"
        aria-busy="true"
        aria-label="Cargando tu resumen"
      >
        <div className="rounded-lg border border-app-border bg-app-surface p-8 shadow-sm">
          <Skeleton type="text" className="h-5 w-28" />
          <Skeleton type="text" className="mt-5 h-12 w-3/4" />
          <Skeleton type="text" className="mt-4 h-4 w-full" />
          <Skeleton type="text" className="mt-2 h-4 w-5/6" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-lg border border-app-border bg-app-surface p-6 shadow-sm"
            >
              <Skeleton type="text" className="h-4 w-28" />
              <Skeleton type="text" className="mt-4 h-8 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-danger-800">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
        <StudentSurface tone={workflowState === "BUILD_FAILED" ? "warm" : "accent"} className="p-8">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="eyebrow text-primary">Qué te toca hacer ahora</div>
                <StatusBadge tone={workflow.tone} className="mt-4">
                  {workflow.label}
                </StatusBadge>
                <h3 className="mt-4 font-display text-4xl leading-tight text-app-text sm:text-5xl">
                  {hasAssignments ? HEADLINE_MAP[workflowState] : "Aún no tienes proyectos"}
                </h3>
                <p className="mt-4 max-w-3xl text-base leading-8 text-app-text-secondary">
                  {hasAssignments
                    ? workflow.description
                    : "Cuando tu profesor te asigne una práctica, desde aquí verás el estado real de tus entregas, el informe técnico y el siguiente paso recomendado."}
                </p>
              </div>

              {activeAssignment ? (
                <div className="rounded-lg border border-app-border/20 bg-app-surface/95 px-4 py-3">
                  <div className="ui-label text-primary">Práctica activa</div>
                  <div className="mt-2 text-sm font-semibold text-app-text">
                    {activeAssignment.projectTitle}
                  </div>
                  <div className="mt-1 text-xs text-app-text-muted">
                    {activeAssignment.deliveryCount} entrega(s) · {activeAssignment.remainingDeliveries} intento(s) disponibles
                  </div>
                </div>
              ) : null}
            </div>

            {activeTimeline ? (
              <div
                className={`rounded-lg border px-5 py-4 ${timelineStyle(activeTimeline.state)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">{activeTimeline.headline}</div>
                    <p className="mt-1 text-sm opacity-90">{activeTimeline.detail}</p>
                  </div>
                  {activeTimeline.countdownLabel ? (
                    <span className="rounded-full bg-app-surface/80 px-3 py-1 text-xs font-bold uppercase">
                      {activeTimeline.countdownLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasAssignments ? (
              <div className="rounded-lg border border-app-border/30 bg-app-surface/85 px-5 py-4">
                <div className="ui-label">Pipeline de evaluación</div>
                <div className="mt-4">
                  <PipelineStepper
                    workflowState={workflowState}
                    stageStartedAt={activeDelivery?.createdAt ?? null}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              {!hasAssignments ? (
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Actualizar página
                </Button>
              ) : workflowState === "BUILD_FAILED" ? (
                <>
                  <Button variant="primary" onClick={() => onNavigate("subir")}>
                    <RiAlertLine />
                    Corregir y reenviar
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate("entregas")}>
                    <RiArrowRightLine />
                    Ver detalles
                  </Button>
                </>
              ) : workflowState === "REPORT_READY" ||
                workflowState === "AWAITING_TEACHER_REVIEW" ||
                workflowState === "GRADED" ? (
                <>
                  <Button variant="primary" onClick={() => onNavigate("informes")}>
                    <RiFileList3Line />
                    Consultar informe
                  </Button>
                  {retryAction?.enabled ? (
                    <Button variant="secondary" onClick={() => onNavigate("subir")}>
                      <RiUploadCloud2Line />
                      {retryAction.label}
                    </Button>
                  ) : null}
                </>
              ) : workflowState === "QUEUED" || workflowState === "RUNNING" ? (
                <Button variant="primary" onClick={() => onNavigate("entregas")}>
                  <RiArrowRightLine />
                  Ver estado de entrega
                </Button>
              ) : workflowState === "RECEIVED" ? (
                <>
                  <Button
                    variant="primary"
                    disabled={launchingId === activeDelivery?.id}
                    onClick={() => activeDelivery && handleLaunchEvaluation(activeDelivery.id)}
                  >
                    {launchingId === activeDelivery?.id ? (
                      <>
                        <RiLoader4Line className="animate-spin motion-reduce:animate-none" />
                        Lanzando...
                      </>
                    ) : (
                      <>
                        <RiRocketLine />
                        Evaluar ahora
                      </>
                    )}
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate("entregas")}>
                    Ver detalles
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" onClick={() => onNavigate("subir")}>
                    <RiUploadCloud2Line />
                    Subir versión
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate("proyectos")}>
                    <RiFolderOpenLine />
                    Ver proyectos
                  </Button>
                </>
              )}
            </div>
          </div>
        </StudentSurface>

        <div className="grid gap-4">
          <StudentSurface>
            <StudentSurfaceHeader
              eyebrow="Práctica activa"
              title={activeAssignment?.projectTitle}
              description={
                activeAssignment
                  ? "Resumen del contexto académico y del margen operativo que todavía te queda en esta práctica."
                  : "Cuando selecciones una práctica, aquí tendrás contexto académico y operativo resumido."
              }
            />
            <StudentKeyValueList
              className="mt-5"
              items={[
                {
                  label: "Apertura",
                  value: formatDate(activeAssignment?.opensAt),
                },
                {
                  label: "Cierre",
                  value: formatDate(activeAssignment?.closesAt),
                },
                {
                  label: "Entregas registradas",
                  value: activeAssignment?.deliveryCount,
                },
                {
                  label: "Intentos disponibles",
                  value: activeAssignment?.remainingDeliveries,
                },
              ]}
            />
          </StudentSurface>

          <StudentSurface tone="subtle">
            <StudentSurfaceHeader
              eyebrow="Última entrega"
              title={activeDelivery ? `Versión v${activeDelivery.version}` : "Todavía no has entregado"}
              description={
                activeDelivery
                  ? "Estado más reciente asociado a tu entrega actual."
                  : "Tu primera entrega aparecerá aquí con su estado, resultado y contexto."
              }
              badge={
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${latestOutcome.className}`}
                >
                  {latestOutcome.label}
                </span>
              }
            />
            <StudentKeyValueList
              className="mt-5"
              items={[
                {
                  label: "Proyecto",
                  value: activeDelivery?.projectTitle ?? "Sin registro",
                },
                {
                  label: "Fecha de envío",
                  value: activeDelivery ? formatDate(activeDelivery.createdAt) : "Sin fecha",
                },
                {
                  label: "Estado académico",
                  value: workflow.label,
                },
                {
                  label: "Nota actual",
                  value:
                    activeDelivery?.grade != null
                      ? (
                        <span className={`font-semibold ${gradeColor(activeDelivery.grade)}`}>
                          {activeDelivery.grade.toFixed(2)}
                        </span>
                      )
                      : "Pendiente",
                },
              ]}
            />
          </StudentSurface>

        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Asignaciones activas"
          value={insights.activeAssignments}
          helper={`${insights.revokedAssignments} revocadas`}
          icon={<RiBookOpenLine />}
          variant="default"
        />
        <MetricCard
          label="Entregas"
          value={insights.totalDeliveries}
          helper={`${insights.pendingEvaluations} en seguimiento`}
          icon={<RiInboxArchiveLine />}
          variant="info"
        />
        <MetricCard
          label="Informes listos"
          value={insights.reportsReady}
          helper={`${insights.blockedReports} con bloqueos`}
          icon={<RiFileList3Line />}
          variant={insights.blockedReports > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Notas oficiales"
          value={insights.officialGrades}
          helper={
            latestGrade !== null
              ? `Última nota ${latestGrade.toFixed(2)}`
              : "Todavía sin nota"
          }
          icon={<RiAwardLine />}
          variant={latestGrade !== null ? "success" : "default"}
        />
      </div>
    </div>
  );
}
