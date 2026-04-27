import { RiUploadCloud2Line, RiArrowRightLine, RiFolderOpenLine, RiFileList3Line } from "react-icons/ri";
import type { SessionRecord } from "../shared/types";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";

interface Props {
  session: SessionRecord | null;
  data: StudentWorkspaceData;
  onNavigate: (tab: any) => void;
}

export function StudentHomeSection({ session, data, onNavigate }: Props): JSX.Element {
  const { selection } = useWorkspace();
  const {
    assignments,
    deliveries,
    latestDelivery,
    latestRunByDeliveryId,
    loading,
    error,
  } = data;

  const activeProjectName = selection.projectTitle ?? (assignments[0]?.projectTitle ?? "Ningún proyecto seleccionado");
  const activeAssignment = assignments.find(a => a.projectId === selection.projectId) || assignments[0];
  const activeDelivery =
    deliveries.find((delivery) => delivery.assignmentId === activeAssignment?.id) ??
    latestDelivery;
  const activeRun = activeDelivery
    ? latestRunByDeliveryId[activeDelivery.id] ?? null
    : null;
  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString("es-ES") : "Sin fecha";
  const now = Date.now();
  const hasAssignments = assignments.length > 0;
  const opensInFuture = Boolean(
    activeAssignment?.opensAt && new Date(activeAssignment.opensAt).getTime() > now,
  );
  const isPastDeadline = Boolean(
    activeAssignment?.closesAt && new Date(activeAssignment.closesAt).getTime() < now,
  );
  
  const maxAttempts = activeAssignment?.maxDeliveriesPerStudent ?? 0;
  const usedAttempts = activeAssignment?.deliveryCount ?? 0;
  const attemptsPercentage = maxAttempts > 0 ? Math.min(100, Math.round((usedAttempts / maxAttempts) * 100)) : 0;
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
  
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
          <div className="h-6 w-48 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
          <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse mt-4" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
          <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }
  
  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">Error: {error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Qué toca hacer */}
        <div className="md:col-span-2 xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
              ¿Qué te toca hacer ahora?
            </div>
            
            {!hasAssignments ? (
              <>
                <h3 className="mt-3 text-xl font-bold text-slate-900">Aún no tienes proyectos</h3>
                <p className="mt-2 text-sm text-slate-600">Contacta con tu profesor para que te asigne una práctica.</p>
              </>
            ) : (
              <>
                <div className={`mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workflow.badgeClassName}`}>
                  {workflow.label}
                </div>
                <h3 className="mt-3 text-xl font-bold text-slate-900">
                  {workflowState === "READY_TO_SUBMIT"
                    ? "Empieza tu entrega"
                    : workflowState === "QUEUED"
                      ? "Tu evaluación está en cola"
                      : workflowState === "RUNNING"
                        ? "La evaluación está ejecutándose"
                        : workflowState === "REPORT_READY"
                          ? "Tu informe está listo"
                          : workflowState === "AWAITING_TEACHER_REVIEW"
                            ? "Falta la revisión final"
                            : workflowState === "GRADED"
                              ? "Tu entrega ya tiene nota"
                              : workflowState === "WINDOW_NOT_OPEN"
                                ? "La ventana todavía no ha abierto"
                                : "Sigue tu entrega"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {workflow.description}
                </p>
                {activeAssignment ? (
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      Apertura: <strong>{formatDate(activeAssignment.opensAt)}</strong>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-4 py-3">
                      Cierre: <strong>{formatDate(activeAssignment.closesAt)}</strong>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {!hasAssignments ? (
              <button className="btn-secondary w-full justify-center" onClick={() => window.location.reload()}>
                Actualizar página
              </button>
            ) : workflowState === "REPORT_READY" || workflowState === "AWAITING_TEACHER_REVIEW" || workflowState === "GRADED" ? (
              <>
                <button className="btn-primary" onClick={() => onNavigate("informes")}>
                  <RiFileList3Line /> Consultar informe
                </button>
                <button className="btn-secondary" onClick={() => onNavigate("subir")}>
                  <RiUploadCloud2Line /> Subir versión
                </button>
              </>
            ) : workflowState === "QUEUED" || workflowState === "RUNNING" || workflowState === "RECEIVED" ? (
              <button className="btn-primary" onClick={() => onNavigate("entregas")}>
                <RiArrowRightLine /> Ver estado de entrega
              </button>
            ) : (
              <>
                <button className="btn-primary" onClick={() => onNavigate("subir")}>
                  <RiUploadCloud2Line /> Subir versión
                </button>
                <button className="btn-secondary" onClick={() => onNavigate("proyectos")}>
                  <RiFolderOpenLine /> Ver proyectos
                </button>
              </>
            )}
          </div>
        </div>

        {/* Última Actividad */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Última Actividad
            </div>
            {activeDelivery ? (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">v{activeDelivery.version}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-sm text-slate-600">{activeDelivery.projectTitle}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Enviado el {new Date(activeDelivery.createdAt).toLocaleString()}
                </div>
                <div className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${workflow.badgeClassName}`}>
                  {workflow.label}
                </div>
                {activeAssignment && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="font-semibold text-slate-700">Intentos consumidos</span>
                      <span className="text-slate-500">{usedAttempts} de {maxAttempts}</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          attemptsPercentage >= 100 ? 'bg-rose-500' : attemptsPercentage > 75 ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${attemptsPercentage}%` }}
                      />
                    </div>
                    {activeDelivery.grade !== null && (
                      <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3">
                        <span className="text-sm text-slate-600">Nota actual</span>
                        <span className="font-bold text-slate-900">{activeDelivery.grade.toFixed(2)}</span>
                      </div>
                    )}
                    {activeDelivery.isLate && (
                      <p className="mt-2 text-xs text-amber-700 font-medium">⚠️ La última entrega quedó registrada fuera de plazo.</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Aún no has realizado ninguna entrega. Aquí aparecerá el progreso de la última versión enviada.</p>
            )}
          </div>
          {activeAssignment ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {opensInFuture ? (
                <span>La ventana de entrega todavía no está abierta.</span>
              ) : isPastDeadline ? (
                <span>El plazo ya venció, pero aún puedes entregar con marca de retraso.</span>
              ) : (
                <span>La ventana de entrega está abierta.</span>
              )}
            </div>
          ) : null}
          {activeDelivery && (
            <button 
              className="mt-6 flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              onClick={() => onNavigate("entregas")}
            >
              Ver todo el historial
              <RiArrowRightLine />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
