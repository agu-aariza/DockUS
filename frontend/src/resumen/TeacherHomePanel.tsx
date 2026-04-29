import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  RiStackFill, RiLayoutGridFill, RiPulseFill, RiLoader4Line, RiArrowRightLine, RiInboxArchiveLine, RiErrorWarningLine, RiFolderOpenLine,
  RiGroupLine, RiCheckboxCircleLine, RiShieldCheckLine, RiAlertLine
} from "react-icons/ri";
import type {
  SessionRecord,
  ProjectEntity,
  DeliveryEntity,
  ProjectOperationalIssuesReconcileResult as ProjectOperationalIssuesSyncResult,
  ProjectOperationalIssuesSummary,
} from "../shared/types";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { projectsApi, deliveriesApi, usersApi } from "../shared/api/services";
import { StatsOverview } from "../shared/components/ui/StatsOverview";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { useToast } from "../shared/toast/ToastContext";
import { getErrorMessage } from "../shared/utils/errors";

interface TeacherHomePanelProps {
  session: SessionRecord | null;
}

export function TeacherHomePanel({ session }: TeacherHomePanelProps): JSX.Element {
  const { selection, setProject, setDelivery } = useWorkspace();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  
  const [recentProjects, setRecentProjects] = useState<ProjectEntity[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<DeliveryEntity[]>([]);
  const [recentEvaluated, setRecentEvaluated] = useState<DeliveryEntity[]>([]);
  const [metrics, setMetrics] = useState({ projects: 0, pending: 0, evaluated: 0, students: 0 });
  const [operationalIssues, setOperationalIssues] = useState<ProjectOperationalIssuesSummary | null>(null);
  const [syncPreview, setSyncPreview] = useState<ProjectOperationalIssuesSyncResult | null>(null);
  const [syncing, setSyncing] = useState<"dry-run" | "apply" | null>(null);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [projRes, delivSubmitted, delivReview, usersRes, issuesRes] = await Promise.all([
        projectsApi.list({ limit: 4, sortOrder: 'DESC' }),
        deliveriesApi.list({ limit: 5, status: 'SUBMITTED', sortOrder: 'DESC' }).catch(() => ({ data: [], meta: { total: 0 } })),
        deliveriesApi.list({ limit: 5, status: 'EVALUATED', sortOrder: 'DESC' }).catch(() => ({ data: [], meta: { total: 0 } })),
        usersApi.list({ role: 'STUDENT', limit: 1 }).catch(() => ({ meta: { total: 0 } })),
        projectsApi.operationalIssues().catch(() => null),
      ]);
      
      setRecentProjects(projRes.data);
      setPendingDeliveries(delivSubmitted.data);
      setRecentEvaluated(delivReview.data);
      setMetrics({
        projects: projRes.meta.total,
        pending: delivSubmitted.meta.total,
        evaluated: delivReview.meta.total,
        students: usersRes.meta.total,
      });
      setOperationalIssues(issuesRes);
    } catch (err) {
      console.error("Error loading dashboard", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleProjectClick = (p: ProjectEntity) => {
    setProject(p.id, p.title);
    navigate("/deliveries");
  };

  const handleDeliveryClick = (d: DeliveryEntity) => {
    if (d.projectId && d.projectTitle) {
      setProject(d.projectId, d.projectTitle);
    }
    setDelivery(d.id, `v${d.version}`);
    navigate("/deliveries");
  };

  const handleValidateResources = async () => {
    setSyncing("dry-run");
    try {
      const result = await projectsApi.reconcileOperationalIssues({
        mode: "dry-run",
      });
      setSyncPreview(result);
      pushToast({
        title: "Validación completada",
        description: `Se han detectado ${result.actions.length} acción(es) pendientes.`,
        tone: "info",
      });
    } catch (error) {
      pushToast({
        title: "No se pudo validar el estado",
        description: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncResources = async () => {
    setSyncing("apply");
    try {
      const result = await projectsApi.reconcileOperationalIssues({
        mode: "apply",
      });
      setSyncPreview(result);
      await loadDashboard();
      pushToast({
        title: "Sincronización aplicada",
        description: `Se aplicaron ${Object.values(result.applied).reduce((sum, value) => sum + value, 0)} acción(es).`,
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "No se pudo sincronizar la infraestructura",
        description: getErrorMessage(error),
        tone: "error",
      });
      throw error;
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Panel de Control</h2>
        <p className="text-slate-500 text-sm">Vista central de tu espacio de trabajo operativo.</p>
      </header>

      {!loading && (
        <StatsOverview stats={[
          { label: 'Proyectos', value: metrics.projects, icon: <RiStackFill className="text-indigo-500" /> },
          { label: 'Entregas por revisar', value: metrics.pending, icon: <RiInboxArchiveLine className="text-amber-500" />, trend: metrics.pending > 0 ? '¡Revisar!' : undefined },
          { label: 'Evaluaciones completadas', value: metrics.evaluated, icon: <RiCheckboxCircleLine className="text-emerald-500" /> },
          { label: 'Estudiantes activos', value: metrics.students, icon: <RiGroupLine className="text-sky-500" /> },
        ]} />
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Active Context Card */}
        <div className="xl:col-span-2 bg-slate-950 text-white rounded-3xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <RiStackFill className="text-9xl" />
          </div>
          
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">
            Contexto Activo
          </h3>

          <div className="space-y-6 relative z-10">
            {selection.projectId ? (
              <div>
                <div className="text-sm font-medium text-slate-400">Proyecto Seleccionado</div>
                <div className="text-2xl font-bold mt-1 tracking-tight">{selection.projectTitle || "Sin título"}</div>
                
                <div className="mt-8 flex flex-wrap gap-4">
                  <button onClick={() => navigate("/projects")} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                    Gestionar Proyecto <RiArrowRightLine />
                  </button>
                  <button onClick={() => navigate("/deliveries")} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                    Ver Entregas <RiLayoutGridFill />
                  </button>
                  <button onClick={() => navigate("/runtime")} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2">
                    Runtime <RiPulseFill />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-slate-400">
                <p className="mb-4">No has seleccionado ningún proyecto todavía.</p>
                <button onClick={() => navigate("/projects")} className="bg-white text-slate-950 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors inline-flex items-center gap-2">
                  Explorar Catálogo <RiArrowRightLine />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Require Attention */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">
            Requiere tu Atención
          </h3>

          <div className="flex-1 space-y-3">
            {loading ? (
              <div className="flex justify-center p-8 text-slate-400">
                <RiLoader4Line className="animate-spin text-2xl" />
              </div>
            ) : (
              <>
                {pendingDeliveries.length > 0 && (
                  <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                    <div className="flex items-center gap-2 font-semibold text-indigo-900 mb-2">
                      <RiInboxArchiveLine /> {pendingDeliveries.length} Entregas pendientes
                    </div>
                    <div className="space-y-2">
                      {pendingDeliveries.slice(0, 2).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="block w-full text-left text-xs bg-white rounded-lg p-2 border border-indigo-100 hover:border-indigo-300 transition-colors">
                          <span className="font-semibold">{d.studentEmail}</span> - v{d.version}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentEvaluated.length > 0 && (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                    <div className="flex items-center gap-2 font-semibold text-emerald-900 mb-2">
                      <RiErrorWarningLine /> {recentEvaluated.length} Evaluaciones recientes
                    </div>
                    <div className="space-y-2">
                      {recentEvaluated.slice(0, 3).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="block w-full text-left text-xs bg-white rounded-lg p-2 border border-emerald-100 hover:border-emerald-300 transition-colors truncate">
                          <span className="font-semibold">{d.studentEmail}</span> - v{d.version} · {d.projectTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDeliveries.length === 0 && recentEvaluated.length === 0 && (
                  <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Todo al día. No hay tareas pendientes urgentes.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="eyebrow">Integridad operativa</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Salud del dominio de proyectos
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Este bloque resume incidencias de datos que ya no rompen el frontend, pero sí conviene limpiar para mantener trazabilidad y confianza operativa.
            </p>
          </div>
          {operationalIssues ? (
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
              {operationalIssues.issues.length} incidencia(s) destacadas
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="btn-secondary"
            onClick={() => void handleValidateResources()}
            disabled={syncing !== null}
          >
            {syncing === "dry-run" ? "Validando..." : "Validar recursos"}
          </button>
          <button
            className="btn-danger"
            onClick={() => setConfirmSyncOpen(true)}
            disabled={syncing !== null}
          >
            Sincronizar infraestructura
          </button>
        </div>

        {loading ? (
          <div className="mt-6 flex justify-center py-10 text-slate-400">
            <RiLoader4Line className="animate-spin text-2xl" />
          </div>
        ) : operationalIssues ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  label: "Asignaciones huérfanas",
                  value: operationalIssues.counts.orphanAssignments,
                  icon: <RiAlertLine className="text-rose-500" />,
                },
                {
                  label: "Entregas huérfanas",
                  value: operationalIssues.counts.orphanDeliveries,
                  icon: <RiAlertLine className="text-rose-500" />,
                },
                {
                  label: "Storage sin padre",
                  value: operationalIssues.counts.orphanStorageObjects,
                  icon: <RiShieldCheckLine className="text-amber-500" />,
                },
                {
                  label: "Asignaciones revocadas",
                  value: operationalIssues.counts.revokedAssignments,
                  icon: <RiGroupLine className="text-slate-500" />,
                },
                {
                  label: "Entregas tardías",
                  value: operationalIssues.counts.lateDeliveries,
                  icon: <RiInboxArchiveLine className="text-amber-500" />,
                },
                {
                  label: "Evaluadas sin nota",
                  value: operationalIssues.counts.ungradedEvaluatedDeliveries,
                  icon: <RiCheckboxCircleLine className="text-indigo-500" />,
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-3 text-slate-500">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                      {item.label}
                    </span>
                    {item.icon}
                  </div>
                  <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </div>
                </article>
                ))}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Qué significan y cómo limpiarlas
                  </h4>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Las incidencias no suelen venir de un único bug: normalmente aparecen por datos históricos, borrados lógicos, registros de prueba, cargas interrumpidas o cambios de contrato entre versiones.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Prioriza primero huérfanas, luego storage, luego calidad operativa
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {[
                  {
                    key: "orphanAssignments",
                    title: "Asignaciones huérfanas",
                    count: operationalIssues.counts.orphanAssignments,
                    tone:
                      operationalIssues.counts.orphanAssignments > 0
                        ? "border-rose-200 bg-rose-50"
                        : "border-slate-200 bg-slate-50",
                    why:
                      "Suelen aparecer cuando un alumno o proyecto fue eliminado, restaurado a medias o quedó referenciado por datos antiguos de seed o pruebas.",
                    cleanup:
                      "Revisa si el proyecto o el alumno deben restaurarse. Si no, elimina esas filas de project_assignments porque ya no representan una asignación operativa válida.",
                  },
                  {
                    key: "orphanDeliveries",
                    title: "Entregas huérfanas",
                    count: operationalIssues.counts.orphanDeliveries,
                    tone:
                      operationalIssues.counts.orphanDeliveries > 0
                        ? "border-rose-200 bg-rose-50"
                        : "border-slate-200 bg-slate-50",
                    why:
                      "Aparecen cuando una entrega apunta a una asignación revocada, a un alumno no operativo o a una relación incompleta creada por datos previos.",
                    cleanup:
                      "Si la asignación debe existir, recupérala. Si no, elimina la entrega huérfana y sus artefactos asociados para que no siga ensuciando historiales ni storage.",
                  },
                  {
                    key: "orphanStorageObjects",
                    title: "Storage sin padre",
                    count: operationalIssues.counts.orphanStorageObjects,
                    tone:
                      operationalIssues.counts.orphanStorageObjects > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-slate-50",
                    why:
                      "Suele venir de subidas canceladas, limpiezas incompletas o borrado lógico de la entrega/proyecto sin reconciliar sus artefactos.",
                    cleanup:
                      "Borra primero el objeto físico en storage y después la fila en storage_objects, salvo que decidas restaurar el padre operativo.",
                  },
                  {
                    key: "revokedAssignments",
                    title: "Asignaciones revocadas",
                    count: operationalIssues.counts.revokedAssignments,
                    tone: "border-slate-200 bg-slate-50",
                    why:
                      "No es un error en sí. Son asignaciones retiradas a propósito y se conservan por trazabilidad.",
                    cleanup:
                      "Normalmente no hace falta limpiarlas. Solo purga históricas si quieres una base más ligera y ya no necesitas auditoría de esas relaciones.",
                  },
                  {
                    key: "lateDeliveries",
                    title: "Entregas tardías",
                    count: operationalIssues.counts.lateDeliveries,
                    tone: "border-slate-200 bg-slate-50",
                    why:
                      "Existen porque la política actual permite entregar fuera de plazo y marcar la entrega como tardía en lugar de bloquearla.",
                    cleanup:
                      "No deben borrarse salvo error humano. Son parte del historial académico y sirven para justificar la corrección o penalización posterior.",
                  },
                  {
                    key: "ungradedEvaluatedDeliveries",
                    title: "Evaluadas sin nota",
                    count: operationalIssues.counts.ungradedEvaluatedDeliveries,
                    tone:
                      operationalIssues.counts.ungradedEvaluatedDeliveries > 0
                        ? "border-indigo-200 bg-indigo-50"
                        : "border-slate-200 bg-slate-50",
                    why:
                      "El builder cerró evidencia técnica, pero el profesorado aún no consolidó la nota oficial en la entrega.",
                    cleanup:
                      "No se limpian borrando: se resuelven entrando en Entregas y publicando grade y graderNotes en cada caso pendiente.",
                  },
                ].map((item) => (
                  <article
                    key={item.key}
                    className={`rounded-2xl border p-4 ${item.tone}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {item.title}
                      </div>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                        {item.count}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      <strong className="text-slate-900">Por qué ocurre:</strong>{" "}
                      {item.why}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      <strong className="text-slate-900">Cómo limpiarla:</strong>{" "}
                      {item.cleanup}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            {syncPreview ? (
              <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Resultado de la última sincronización
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Modo {syncPreview.mode}. Las acciones marcadas como <strong>would_apply</strong> son seguras pero todavía no se han ejecutado.
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {syncPreview.actions.length} acción(es)
                  </div>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {(["orphanAssignments", "orphanDeliveries", "orphanStorageObjects"] as const).map((category) => (
                    <article key={category} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {category}
                      </div>
                      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                        {syncPreview.applied[category]} / {syncPreview.matched[category]}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        aplicadas / detectadas
                      </div>
                    </article>
                  ))}
                </div>
                <div className="mt-5 space-y-3">
                  {syncPreview.actions.slice(0, 8).map((action) => (
                    <article key={`${action.category}-${action.targetId}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-slate-900">{action.action}</div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                          {action.outcome}
                        </span>
                      </div>
                      <div className="mt-2 text-slate-600">{action.detail}</div>
                      <div className="mt-2 text-xs text-slate-500">
                        {action.category} · {action.targetId.slice(0, 8)}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Incidencias destacadas
                </h4>
                <span className="text-xs text-slate-500">
                  Se excluyen de los listados operativos para evitar errores 500
                </span>
              </div>

              {operationalIssues.issues.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  No se han detectado incidencias activas en esta revisión.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {operationalIssues.issues.map((issue) => (
                    <article
                      key={issue.id}
                      className={`rounded-2xl border bg-white p-4 ${
                        issue.severity === "error"
                          ? "border-rose-200"
                          : "border-amber-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-950">
                            {issue.title}
                          </div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
                            {issue.category} {issue.projectTitle ? `· ${issue.projectTitle}` : ""}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            issue.severity === "error"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {issue.severity === "error" ? "Error" : "Aviso"}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {issue.detail}
                      </p>
                      {issue.createdAt ? (
                        <div className="mt-3 text-xs text-slate-500">
                          Detectado sobre registro del {new Date(issue.createdAt).toLocaleString("es-ES")}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No se pudieron cargar las incidencias operativas en este momento.
          </div>
        )}
      </section>

      {/* Proyectos Recientes */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Proyectos Recientes</h3>
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 w-64 bg-slate-100 animate-pulse rounded-2xl"></div>)}
          </div>
        ) : recentProjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleProjectClick(p)}
                className="group flex flex-col text-left p-5 rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between w-full mb-3">
                  <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                    <RiFolderOpenLine className="text-xl" />
                  </div>
                  <RiArrowRightLine className="text-slate-300 transition group-hover:text-indigo-600 group-hover:translate-x-1" />
                </div>
                <div className="font-semibold text-sm text-slate-900 group-hover:text-indigo-700 line-clamp-1">{p.title}</div>
                <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{p.status === 'ACTIVE' ? 'Activo' : 'Completado'}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic bg-white p-6 rounded-2xl border border-slate-200">
            No hay proyectos disponibles.
          </div>
        )}
      </div>

      <DangerConfirmModal
        open={confirmSyncOpen}
        title="Sincronizar infraestructura"
        description="Esta acción marcará asignaciones y entregas huérfanas para sacarlas del flujo operativo y limpiará artefactos de storage sin padre válido."
        confirmWord="SINCRONIZAR"
        confirmButtonLabel="Aplicar sincronización"
        loadingLabel="Sincronizando..."
        onCancel={() => setConfirmSyncOpen(false)}
        onConfirm={handleSyncResources}
      />
    </div>
  );
}
