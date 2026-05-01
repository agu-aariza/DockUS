import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  RiStackFill, RiLayoutGridFill, RiPulseFill, RiLoader4Line, RiArrowRightLine, RiInboxArchiveLine, RiErrorWarningLine, RiFolderOpenLine,
  RiGroupLine, RiCheckboxCircleLine, RiShieldCheckLine, RiAlertLine, RiRefreshLine, RiInboxArchiveFill
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
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";

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
        projectsApi.getOperationalIssues().catch(() => null),
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
        description: `Se aplicaron ${(Object.values(result.applied) as number[]).reduce((sum, value) => sum + value, 0)} acción(es).`,
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
      <PageHeader 
        title="Panel de Control"
        subtitle="Centro de inteligencia operativa para el seguimiento académico y el control de integridad en tiempo real."
        icon={<RiStackFill />}
      />

      {!loading && (
        <StatsOverview stats={[
          { label: 'Proyectos', value: metrics.projects, icon: <RiStackFill className="text-brand-blue" /> },
          { label: 'Entregas por revisar', value: metrics.pending, icon: <RiInboxArchiveLine className="text-amber-500" />, trend: metrics.pending > 0 ? '¡Revisar!' : undefined },
          { label: 'Evaluaciones completadas', value: metrics.evaluated, icon: <RiCheckboxCircleLine className="text-emerald-500" /> },
          { label: 'Estudiantes activos', value: metrics.students, icon: <RiGroupLine className="text-brand-gold" /> },
        ]} />
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Active Context Card */}
        <div className="xl:col-span-2 bg-brand-maroon text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden group border border-brand-maroon-dark">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transition-transform group-hover:scale-110 duration-700">
            <RiStackFill className="text-[12rem]" />
          </div>
          
          <div className="relative z-10">
            <h3 className="eyebrow text-slate-500 mb-8">
              Ecosistema Operativo Activo
            </h3>

            {selection.projectId ? (
              <div className="animate-in slide-in-from-left-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold-light ui-label mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                  Proyecto Seleccionado
                </div>
                <div className="text-4xl font-bold tracking-tight mb-2">{selection.projectTitle || "Sin título"}</div>
                <p className="text-slate-400 text-sm max-w-md">Orquestando sobre este proyecto. El sistema ha sincronizado automáticamente los filtros de entregas, histórico y runtime.</p>
                
                <div className="mt-10 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => navigate("/projects")} className="!bg-brand-secondary !hover:bg-brand-secondary-dark border-none px-8">
                    Gestionar Proyecto <RiArrowRightLine />
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/deliveries")} className="!bg-slate-800 !text-white !border-slate-700 !hover:bg-slate-700 px-6">
                    <RiLayoutGridFill className="text-slate-400" /> Ver Entregas
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/runtime")} className="!bg-slate-800 !text-white !border-slate-700 !hover:bg-slate-700 px-6">
                    <RiPulseFill className="text-slate-400" /> Runtime
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center lg:text-left">
                <p className="text-slate-400 text-lg mb-8">No has seleccionado ningún proyecto todavía para empezar a operar.</p>
                <Button variant="primary" onClick={() => navigate("/projects")} className="!bg-white !text-slate-950 !hover:bg-slate-200 border-none px-10 h-14 text-base">
                  Explorar Catálogo <RiArrowRightLine />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Require Attention */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="eyebrow text-brand-blue">
              Prioridades de Gestión
            </h3>
            <span className="flex h-2 w-2 rounded-full bg-brand-blue animate-ping" />
          </div>

          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
                <RiLoader4Line className="animate-spin text-3xl" />
                <span className="ui-label">Buscando alertas...</span>
              </div>
            ) : (
              <>
                {pendingDeliveries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <RiInboxArchiveLine className="text-brand-blue" /> 
                      {metrics.pending} Entregas esperando revisión
                    </div>
                    <div className="space-y-2">
                      {pendingDeliveries.slice(0, 3).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="group w-full flex items-center justify-between bg-slate-50 hover:bg-white rounded-2xl p-3 border border-slate-100 hover:border-brand-blue/20 hover:shadow-md transition-all">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">v{d.version} · {d.projectTitle}</div>
                            <div className="ui-label text-slate-500 mt-0.5 truncate">{d.studentEmail}</div>
                          </div>
                          <RiArrowRightLine className="text-slate-300 group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentEvaluated.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                      <RiCheckboxCircleLine className="text-emerald-500" /> 
                      Últimas evaluaciones
                    </div>
                    <div className="space-y-2">
                      {recentEvaluated.slice(0, 2).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="group w-full flex items-center justify-between bg-slate-50 hover:bg-white rounded-2xl p-3 border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all">
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-xs truncate">{d.studentEmail}</div>
                            <div className="ui-label text-slate-500 mt-0.5 truncate">v{d.version} · {d.projectTitle}</div>
                          </div>
                          <div className="ui-label text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Evaluada</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDeliveries.length === 0 && recentEvaluated.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <RiShieldCheckLine className="text-4xl text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500 font-medium">Todo al día. No hay tareas pendientes urgentes.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 ui-label mb-3">
              Auditoría Técnica
            </div>
            <h3 className="text-3xl font-bold tracking-tight text-slate-950">
              Auditoría de Integridad y Trazabilidad
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              Diagnóstico avanzado del grafo de datos. Este bloque garantiza la consistencia operativa y la persistencia impecable de evidencias críticas en todo el dominio.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => void handleValidateResources()}
              disabled={syncing !== null}
            >
              {syncing === "dry-run" ? <RiLoader4Line className="animate-spin" /> : <RiShieldCheckLine />}
              {syncing === "dry-run" ? "Validando..." : "Validar recursos"}
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmSyncOpen(true)}
              disabled={syncing !== null}
            >
              <RiRefreshLine className={syncing === "apply" ? "animate-spin" : ""} />
              Sincronizar infraestructura
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-slate-400">
            <RiLoader4Line className="animate-spin text-4xl" />
          </div>
        ) : operationalIssues ? (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Asignaciones", value: operationalIssues.counts.orphanAssignments, status: operationalIssues.counts.orphanAssignments > 0 ? 'critical' : 'stable' },
                { label: "Entregas", value: operationalIssues.counts.orphanDeliveries, status: operationalIssues.counts.orphanDeliveries > 0 ? 'critical' : 'stable' },
                { label: "Storage", value: operationalIssues.counts.orphanStorageObjects, status: operationalIssues.counts.orphanStorageObjects > 0 ? 'warning' : 'stable' },
                { label: "Revocadas", value: operationalIssues.counts.revokedAssignments, status: 'stable' },
                { label: "Tardías", value: operationalIssues.counts.lateDeliveries, status: 'warning' },
                { label: "Sin nota", value: operationalIssues.counts.ungradedEvaluatedDeliveries, status: operationalIssues.counts.ungradedEvaluatedDeliveries > 0 ? 'warning' : 'stable' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 flex flex-col items-center text-center">
                  <div className="eyebrow text-slate-400 mb-2">{item.label}</div>
                  <div className={`text-2xl font-bold ${
                    item.status === 'critical' ? 'text-rose-600' : 
                    item.status === 'warning' ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="eyebrow text-slate-400">Detecciones Críticas</h4>
                {[
                  {
                    key: "orphanAssignments",
                    title: "Asignaciones huérfanas",
                    count: operationalIssues.counts.orphanAssignments,
                    severity: operationalIssues.counts.orphanAssignments > 0 ? "error" : "stable",
                    desc: "Alumnos o proyectos eliminados que aún conservan vínculos referenciales activos."
                  },
                  {
                    key: "orphanDeliveries",
                    title: "Entregas huérfanas",
                    count: operationalIssues.counts.orphanDeliveries,
                    severity: operationalIssues.counts.orphanDeliveries > 0 ? "error" : "stable",
                    desc: "Archivos y registros de entrega que no cuelgan de una asignación válida."
                  },
                  {
                    key: "orphanStorageObjects",
                    title: "Storage sin padre",
                    count: operationalIssues.counts.orphanStorageObjects,
                    severity: operationalIssues.counts.orphanStorageObjects > 0 ? "warning" : "stable",
                    desc: "Objetos físicos en el sistema de archivos sin metadatos asociados."
                  }
                ].map(item => (
                  <div key={item.key} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    item.severity === 'error' ? 'bg-rose-50 border-rose-100 shadow-sm' : 
                    item.severity === 'warning' ? 'bg-amber-50 border-amber-100 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}>
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      item.severity === 'error' ? 'bg-rose-500 animate-pulse' : 
                      item.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                        <span className="text-xs font-black text-slate-400">{item.count}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="eyebrow text-slate-400">Pendientes de Gestión</h4>
                {[
                  {
                    key: "ungraded",
                    title: "Evaluadas sin nota",
                    count: operationalIssues.counts.ungradedEvaluatedDeliveries,
                    severity: operationalIssues.counts.ungradedEvaluatedDeliveries > 0 ? "warning" : "stable",
                    desc: "El motor técnico ha terminado pero falta la consolidación del docente."
                  },
                  {
                    key: "late",
                    title: "Entregas tardías",
                    count: operationalIssues.counts.lateDeliveries,
                    severity: "stable",
                    desc: "Entregas registradas fuera del plazo oficial del proyecto."
                  }
                ].map(item => (
                  <div key={item.key} className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                    item.severity === 'warning' ? 'bg-brand-maroon/5 border-brand-maroon/10 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}>
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                      item.severity === 'warning' ? 'bg-brand-blue' : 'bg-slate-300'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                        <span className="text-xs font-black text-slate-400">{item.count}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500">
            No se pudieron cargar las métricas de integridad.
          </div>
        )}
      </section>

      {syncPreview && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 ui-label mb-3">
                Vista Previa de Sincronización
              </div>
              <h4 className="text-xl font-bold tracking-tight text-slate-950">
                Resultado del Análisis ({syncPreview.mode})
              </h4>
              <p className="mt-2 text-sm text-slate-500">
                Las acciones marcadas como <strong className="text-slate-700">would_apply</strong> son seguras pero todavía no se han ejecutado permanentemente.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {syncPreview.actions.length} acción(es) detectada(s)
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {(["orphanAssignments", "orphanDeliveries", "orphanStorageObjects"] as const).map((category) => (
              <div key={category} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="eyebrow text-slate-400 mb-2">{category}</div>
                <div className="text-xl font-bold text-slate-900">
                  {syncPreview.applied[category]} / {syncPreview.matched[category]}
                </div>
                <div className="ui-label text-slate-500 mt-1">Aplicadas / Detectadas</div>
              </div>
            ))}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {syncPreview.actions.map((action, idx) => (
              <div key={`${action.targetId}-${idx}`} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-slate-900 text-sm">{action.action}</span>
                    <span className="ui-label text-slate-400">{action.category}</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">{action.detail}</div>
                </div>
                <div className={`ui-label px-2 py-1 rounded-full border ${
                  action.outcome === 'applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                  action.outcome === 'would_apply' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {action.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {operationalIssues && operationalIssues.issues.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
          <div className="flex items-center justify-between mb-8">
            <h4 className="eyebrow text-slate-400">
              Incidencias destacadas ({operationalIssues.issues.length})
            </h4>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {operationalIssues.issues.map((issue) => (
              <div key={issue.id} className={`p-5 rounded-2xl border bg-white shadow-sm transition-transform hover:-translate-y-1 ${
                issue.severity === "error" ? "border-rose-100" : "border-amber-100"
              }`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm mb-0.5">{issue.title}</div>
                    <div className="ui-label text-slate-400">
                      {issue.category} {issue.projectTitle ? `· ${issue.projectTitle}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 ui-label px-2 py-0.5 rounded-full border ${
                    issue.severity === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {issue.severity === "error" ? "Crítico" : "Aviso"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                  {issue.detail}
                </p>
                {issue.createdAt && (
                  <div className="mt-4 pt-3 border-t border-slate-50 ui-label text-slate-400 italic">
                    Detectado el {new Date(issue.createdAt).toLocaleString("es-ES")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proyectos Recientes */}
      <div>
        <h3 className="font-display text-lg font-bold text-slate-900 mb-4 uppercase tracking-wider">Proyectos Recientes</h3>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 min-w-[240px] bg-slate-100 animate-pulse rounded-2xl"></div>)}
          </div>
        ) : recentProjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleProjectClick(p)}
                className="group flex flex-col text-left p-6 rounded-2xl border border-slate-200 bg-white hover:border-brand-blue/30 hover:shadow-xl hover:shadow-brand-blue/5 transition-all duration-300"
              >
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="rounded-xl bg-brand-maroon/5 p-2.5 text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white transition-colors duration-300">
                    <RiFolderOpenLine className="text-xl" />
                  </div>
                  <RiArrowRightLine className="text-slate-300 transition group-hover:text-brand-blue group-hover:translate-x-1" />
                </div>
                <div className="font-bold text-slate-900 group-hover:text-brand-blue mb-1 line-clamp-1">{p.title}</div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <div className="ui-label text-slate-500">{p.status === 'ACTIVE' ? 'En curso' : 'Finalizado'}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
            <RiStackFill className="text-4xl text-slate-200 mb-4" />
            <p className="text-slate-500 text-sm font-medium">No hay proyectos registrados todavía.</p>
            <Button variant="primary" onClick={() => navigate("/projects")} className="mt-4 !h-auto !py-2">Crear primer proyecto</Button>
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
