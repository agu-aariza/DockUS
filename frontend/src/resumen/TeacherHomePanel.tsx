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
import { CohortAnalyticsDashboard } from "./components/CohortAnalyticsDashboard";
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

      {!loading && (
        <section className="space-y-4">
          <h3 className="font-display text-lg font-bold text-academic-on-surface uppercase tracking-wider">Métricas de Cohorte y Rendimiento</h3>
          <CohortAnalyticsDashboard
            initialProjectId={selection.projectId}
            projects={recentProjects}
            onSelectProject={(id) => {
              const proj = recentProjects.find((p) => p.id === id);
              if (proj) {
                setProject(proj.id, proj.title);
              }
            }}
          />
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in-50 duration-500">
        {/* Active Context Card */}
        <div className="xl:col-span-2 bg-gradient-to-br from-brand-maroon to-brand-maroon-dark text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden group border border-brand-maroon-dark/50">
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transition-transform group-hover:scale-110 duration-700">
            <RiStackFill className="text-[12rem]" />
          </div>
          
          <div className="relative z-10">
            <h3 className="eyebrow text-brand-gold-light/60 mb-8">
              Ecosistema Operativo Activo
            </h3>

            {selection.projectId ? (
              <div className="animate-in slide-in-from-left-4 duration-300">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/20 text-brand-gold-light ui-label mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse" />
                  Proyecto Seleccionado
                </div>
                <div className="text-4xl font-bold tracking-tight mb-2 font-display">{selection.projectTitle || "Sin título"}</div>
                <p className="text-white/70 text-sm max-w-md leading-relaxed">Orquestando sobre este proyecto. El sistema ha sincronizado automáticamente los filtros de entregas, histórico y runtime.</p>
                
                <div className="mt-10 flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => navigate("/projects")} className="!bg-brand-gold !text-white !hover:bg-brand-gold-dark border-none px-8 font-bold shadow-lg shadow-brand-gold/10">
                    Gestionar Proyecto <RiArrowRightLine />
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/deliveries")} className="!bg-white/10 !text-white !border-white/15 !hover:bg-white/20 px-6 font-bold backdrop-blur-sm transition-all duration-300">
                    <RiLayoutGridFill className="text-white/70" /> Ver Entregas
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/runtime")} className="!bg-white/10 !text-white !border-white/15 !hover:bg-white/20 px-6 font-bold backdrop-blur-sm transition-all duration-300">
                    <RiPulseFill className="text-white/70" /> Runtime
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center lg:text-left">
                <p className="text-white/75 text-lg mb-8">No has seleccionado ningún proyecto todavía para empezar a operar.</p>
                <Button variant="primary" onClick={() => navigate("/projects")} className="!bg-white !text-brand-maroon !hover:bg-brand-gold-light/10 border-none px-10 h-14 text-base font-bold shadow-lg">
                  Explorar Catálogo <RiArrowRightLine />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Require Attention */}
        <div className="bg-white border border-academic-outline/25 rounded-3xl p-6 shadow-academic flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="eyebrow text-brand-blue">
              Prioridades de Gestión
            </h3>
            <span className="flex h-2 w-2 rounded-full bg-brand-blue animate-ping" />
          </div>

          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-academic-on-surface-variant/75 gap-3">
                <RiLoader4Line className="animate-spin text-3xl text-brand-gold" />
                <span className="ui-label">Buscando alertas...</span>
              </div>
            ) : (
              <>
                {pendingDeliveries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-academic-on-surface">
                      <RiInboxArchiveLine className="text-brand-blue text-base" /> 
                      {metrics.pending} Entregas esperando revisión
                    </div>
                    <div className="space-y-2">
                      {pendingDeliveries.slice(0, 3).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="group w-full flex items-center justify-between bg-academic-surface hover:bg-white rounded-2xl p-3 border border-academic-outline-variant/30 hover:border-brand-blue/30 hover:shadow-academic transition-all">
                          <div className="min-w-0">
                            <div className="font-bold text-academic-on-surface text-xs truncate">v{d.version} · {d.projectTitle}</div>
                            <div className="ui-label text-academic-on-surface-variant mt-0.5 truncate">{d.studentEmail}</div>
                          </div>
                          <RiArrowRightLine className="text-academic-outline-variant group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentEvaluated.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-academic-outline/10">
                    <div className="flex items-center gap-2 text-sm font-bold text-academic-on-surface">
                      <RiCheckboxCircleLine className="text-emerald-500 text-base" /> 
                      Últimas evaluaciones
                    </div>
                    <div className="space-y-2">
                      {recentEvaluated.slice(0, 2).map(d => (
                        <button key={d.id} onClick={() => handleDeliveryClick(d)} className="group w-full flex items-center justify-between bg-academic-surface hover:bg-white rounded-2xl p-3 border border-academic-outline-variant/30 hover:border-emerald-300 hover:shadow-academic transition-all">
                          <div className="min-w-0">
                            <div className="font-bold text-academic-on-surface text-xs truncate">{d.studentEmail}</div>
                            <div className="ui-label text-academic-on-surface-variant mt-0.5 truncate">v{d.version} · {d.projectTitle}</div>
                          </div>
                          <div className="ui-label text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full">Evaluada</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDeliveries.length === 0 && recentEvaluated.length === 0 && (
                  <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-academic-surface-container rounded-2xl border border-dashed border-academic-outline-variant/40">
                    <RiShieldCheckLine className="text-4xl text-academic-outline-variant mb-3" />
                    <p className="text-sm text-academic-on-surface-variant font-semibold">Todo al día. No hay tareas pendientes urgentes.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-academic-outline/20 bg-white p-8 shadow-academic">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-academic-surface-container border border-academic-outline-variant/30 text-academic-on-surface-variant ui-label mb-3 font-bold">
              Auditoría Técnica
            </div>
            <h3 className="text-3xl font-black tracking-tight text-academic-on-surface font-display">
              Auditoría de Integridad y Trazabilidad
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-academic-on-surface-variant">
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
          <div className="flex justify-center py-20 text-brand-gold">
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
                <div key={item.label} className="rounded-2xl border border-academic-outline-variant/20 bg-academic-surface-container/50 p-4 flex flex-col items-center text-center shadow-sm">
                  <div className="eyebrow text-academic-on-surface-variant/80 mb-2">{item.label}</div>
                  <div className={`text-2xl font-black ${
                    item.status === 'critical' ? 'text-rose-600 font-display' : 
                    item.status === 'warning' ? 'text-amber-600 font-display' : 'text-academic-on-surface font-display'
                  }`}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h4 className="eyebrow text-academic-on-surface-variant/80">Detecciones Críticas</h4>
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
                    item.severity === 'warning' ? 'bg-amber-50/60 border-amber-100 shadow-sm' : 'bg-academic-surface border-academic-outline-variant/30 opacity-60'
                  }`}>
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      item.severity === 'error' ? 'bg-rose-500 animate-pulse' : 
                      item.severity === 'warning' ? 'bg-amber-500' : 'bg-academic-outline-variant'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-academic-on-surface text-sm">{item.title}</span>
                        <span className="text-xs font-black text-academic-on-surface-variant/70">{item.count}</span>
                      </div>
                      <p className="text-xs text-academic-on-surface-variant leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <h4 className="eyebrow text-academic-on-surface-variant/80">Pendientes de Gestión</h4>
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
                    item.severity === 'warning' ? 'bg-brand-maroon/5 border-brand-maroon/10 shadow-sm' : 'bg-academic-surface border-academic-outline-variant/30 opacity-60'
                  }`}>
                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                      item.severity === 'warning' ? 'bg-brand-blue' : 'bg-academic-outline-variant'
                    }`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-academic-on-surface text-sm">{item.title}</span>
                        <span className="text-xs font-black text-academic-on-surface-variant/70">{item.count}</span>
                      </div>
                      <p className="text-xs text-academic-on-surface-variant leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center bg-academic-surface-container rounded-2xl border border-dashed border-academic-outline-variant/40 text-academic-on-surface-variant">
            No se pudieron cargar las métricas de integridad.
          </div>
        )}
      </section>

      {syncPreview && (
        <div className="rounded-3xl border border-academic-outline/25 bg-white p-8 shadow-academic">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 ui-label mb-3 font-bold">
                Vista Previa de Sincronización
              </div>
              <h4 className="text-xl font-bold tracking-tight text-academic-on-surface">
                Resultado del Análisis ({syncPreview.mode})
              </h4>
              <p className="mt-2 text-sm text-academic-on-surface-variant">
                Las acciones marcadas como <strong className="text-academic-on-surface">would_apply</strong> son seguras pero todavía no se han ejecutado permanentemente.
              </p>
            </div>
            <div className="rounded-full border border-academic-outline-variant/40 bg-academic-surface-container px-3 py-1 text-xs font-bold text-academic-on-surface">
              {syncPreview.actions.length} acción(es) detectada(s)
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 mb-8">
            {(["orphanAssignments", "orphanDeliveries", "orphanStorageObjects"] as const).map((category) => (
              <div key={category} className="rounded-2xl border border-academic-outline-variant/30 bg-academic-surface-container/50 p-4">
                <div className="eyebrow text-academic-on-surface-variant/80 mb-2">{category}</div>
                <div className="text-xl font-bold text-academic-on-surface font-display">
                  {syncPreview.applied[category]} / {syncPreview.matched[category]}
                </div>
                <div className="ui-label text-academic-on-surface-variant mt-1">Aplicadas / Detectadas</div>
              </div>
            ))}
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {syncPreview.actions.map((action, idx) => (
              <div key={`${action.targetId}-${idx}`} className="flex items-center justify-between p-4 bg-academic-surface border border-academic-outline-variant/30 rounded-2xl hover:bg-white transition-colors duration-200 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-academic-on-surface text-sm">{action.action}</span>
                    <span className="ui-label text-academic-on-surface-variant/80">{action.category}</span>
                  </div>
                  <div className="text-xs text-academic-on-surface-variant truncate">{action.detail}</div>
                </div>
                <div className={`ui-label px-2 py-1 rounded-full border ${
                  action.outcome === 'applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                  action.outcome === 'would_apply' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-academic-surface-container text-academic-on-surface-variant border-academic-outline-variant/30'
                }`}>
                  {action.outcome}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {operationalIssues && operationalIssues.issues.length > 0 && (
        <div className="rounded-3xl border border-academic-outline/25 bg-academic-surface-container-low p-8 shadow-inner">
          <div className="flex items-center justify-between mb-8">
            <h4 className="eyebrow text-academic-on-surface-variant/80">
              Incidencias destacadas ({operationalIssues.issues.length})
            </h4>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {operationalIssues.issues.map((issue) => (
              <div key={issue.id} className={`p-5 rounded-2xl border bg-white shadow-sm transition-transform hover:-translate-y-1 ${
                issue.severity === "error" ? "border-rose-100 hover:border-rose-300" : "border-amber-100 hover:border-amber-300"
              }`}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-academic-on-surface text-sm mb-0.5">{issue.title}</div>
                    <div className="ui-label text-academic-on-surface-variant">
                      {issue.category} {issue.projectTitle ? `· ${issue.projectTitle}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 ui-label px-2 py-0.5 rounded-full border ${
                    issue.severity === "error" ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                    {issue.severity === "error" ? "Crítico" : "Aviso"}
                  </span>
                </div>
                <p className="text-xs text-academic-on-surface-variant leading-relaxed line-clamp-2">
                  {issue.detail}
                </p>
                {issue.createdAt && (
                  <div className="mt-4 pt-3 border-t border-academic-outline/10 ui-label text-academic-on-surface-variant/75 italic">
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
        <h3 className="font-display text-lg font-bold text-academic-on-surface mb-4 uppercase tracking-wider">Proyectos Recientes</h3>
        {loading ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 min-w-[240px] bg-academic-surface-container animate-pulse rounded-2xl"></div>)}
          </div>
        ) : recentProjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentProjects.map(p => (
              <button 
                key={p.id} 
                onClick={() => handleProjectClick(p)}
                className="group flex flex-col text-left p-6 rounded-2xl border border-academic-outline/25 bg-white hover:border-brand-blue/40 hover:shadow-academic-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="rounded-xl bg-brand-maroon/5 p-2.5 text-brand-maroon group-hover:bg-brand-maroon group-hover:text-white transition-colors duration-300">
                    <RiFolderOpenLine className="text-xl" />
                  </div>
                  <RiArrowRightLine className="text-academic-outline-variant transition group-hover:text-brand-blue group-hover:translate-x-1" />
                </div>
                <div className="font-bold text-academic-on-surface group-hover:text-brand-blue mb-1 line-clamp-1 font-display">{p.title}</div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-academic-outline-variant'}`} />
                  <div className="ui-label text-academic-on-surface-variant">{p.status === 'ACTIVE' ? 'En curso' : 'Finalizado'}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 bg-academic-surface-container rounded-3xl border border-dashed border-academic-outline-variant/40">
            <RiStackFill className="text-4xl text-academic-outline-variant mb-4" />
            <p className="text-academic-on-surface-variant text-sm font-semibold">No hay proyectos registrados todavía.</p>
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
