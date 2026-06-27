import {
  RiAlertLine,
  RiArrowRightLine,
  RiAwardLine,
  RiBookOpenLine,
  RiFileList3Line,
  RiFolderOpenLine,
  RiInboxArchiveLine,
  RiUploadCloud2Line,
} from "react-icons/ri";

import type { SessionRecord, StudentWorkflowState } from "../shared/types";
import { MetricCard } from "../shared/components/MetricCard";
import { Button } from "../shared/components/ui/Button";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
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

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (_tab: any) => void;
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
          "border-emerald-200 bg-emerald-50/70 text-emerald-700 font-semibold",
      };
    case "FAIL":
      return {
        label: "No apto",
        className: "border-rose-200 bg-rose-50/70 text-rose-700 font-semibold",
      };
    case "PARTIAL":
      return {
        label: "Parcial",
        className: "border-amber-200 bg-amber-50/70 text-amber-700 font-semibold",
      };
    case "UNKNOWN":
      return {
        label: "Sin resolver",
        className: "border-app-border/30 bg-slate-50 text-slate-500 font-semibold",
      };
    default:
      return {
        label: "Sin run",
        className: "border-app-border/20 bg-slate-50/80 text-slate-500/80",
      };
  }
}

function gradeColor(grade: number): string {
  if (grade >= 9) return "text-emerald-700";
  if (grade >= 5) return "text-emerald-600";
  return "text-rose-700";
}

function timelineStyle(state: string): string {
  switch (state) {
    case "late":
      return "border-rose-200 bg-rose-50/70 text-rose-700 font-semibold";
    case "upcoming":
      return "border-primary/20 bg-primary/5 text-primary font-semibold";
    default:
      return "border-emerald-100 bg-emerald-50/70 text-emerald-700 font-semibold";
  }
}

export function StudentHomeSection({
  session: _session,
  data,
  onNavigate,
}: Props): JSX.Element {
  const { selection } = useWorkspace();
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
      <div className="grid gap-6 lg:grid-cols-[1.55fr,0.95fr]">
        <div className="rounded-lg border border-app-border bg-white p-8">
          <div className="h-5 w-28 animate-pulse rounded bg-app-bg-subtle/30" />
          <div className="mt-5 h-12 w-3/4 animate-pulse rounded bg-slate-50/60" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-50/60" />
          <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-50/60" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="rounded-lg border border-app-border bg-white p-6"
            >
              <div className="h-4 w-28 animate-pulse rounded bg-app-bg-subtle/30" />
              <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-slate-50/60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
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
                <div
                  className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflow.badgeClassName}`}
                >
                  {workflow.label}
                </div>
                <h3 className="mt-4 text-4xl font-semibold text-slate-900 sm:text-5xl">
                  {hasAssignments ? HEADLINE_MAP[workflowState] : "Aún no tienes proyectos"}
                </h3>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-500">
                  {hasAssignments
                    ? workflow.description
                    : "Cuando tu profesor te asigne una práctica, desde aquí verás el estado real de tus entregas, el informe técnico y el siguiente paso recomendado."}
                </p>
              </div>

              {activeAssignment ? (
                <div className="rounded-lg border border-app-border/20 bg-white/95 px-4 py-3">
                  <div className="ui-label text-primary">Práctica activa</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {activeAssignment.projectTitle}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
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
                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase">
                      {activeTimeline.countdownLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasAssignments ? (
              <div className="rounded-lg border border-app-border/30 bg-white/85 px-5 py-4">
                <div className="ui-label text-slate-400">Pipeline de evaluación</div>
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
              ) : workflowState === "QUEUED" ||
                workflowState === "RUNNING" ||
                workflowState === "RECEIVED" ? (
                <Button variant="primary" onClick={() => onNavigate("entregas")}>
                  <RiArrowRightLine />
                  Ver estado de entrega
                </Button>
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
              title={activeAssignment?.projectTitle ?? "Sin práctica seleccionada"}
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
                  value: activeAssignment?.deliveryCount ?? 0,
                },
                {
                  label: "Intentos disponibles",
                  value: activeAssignment?.remainingDeliveries ?? 0,
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
