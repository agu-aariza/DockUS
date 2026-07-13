import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RiStackLine,
  RiPulseLine,
  RiInboxArchiveLine,
  RiFolderOpenLine,
  RiGroupLine,
  RiCheckboxCircleLine,
  RiShieldCheckLine,

  RiRefreshLine,
  RiLoader4Line,
  RiArrowRightLine,
  RiAddLine,
} from "react-icons/ri";
import type { ProjectEntity, ProjectOperationalIssuesReconcileResult as ProjectOperationalIssuesSyncResult, ProjectOperationalIssuesSummary } from "../features/projects/types";
import type { DeliveryEntity } from "../features/deliveries/types";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { projectsApi, deliveriesApi, usersApi } from "../shared/api/services";
import { StatsOverview } from "../shared/components/ui/StatsOverview";
import { CohortAnalyticsDashboard } from "./components/CohortAnalyticsDashboard";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { useToast } from "../shared/toast/ToastContext";
import { getErrorMessage } from "../shared/utils/errors";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { SectionCard } from "../shared/components/ui/Layout";

import { StatusBadge, type StatusTone } from "../shared/components/ui/StatusBadge";
import { EmptyState } from "../shared/components/EmptyState";

export function TeacherHomePanel(): JSX.Element {
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
    navigate("/projects");
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
      const result = await projectsApi.reconcileOperationalIssues({ mode: "dry-run" });
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
      const result = await projectsApi.reconcileOperationalIssues({ mode: "apply" });
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

  const globalStats = loading
    ? []
    : [
        { label: 'Proyectos', value: metrics.projects, icon: <RiStackLine />, variant: 'default' as const },
        { label: 'Pendientes de revisión', value: metrics.pending, icon: <RiInboxArchiveLine />, variant: (metrics.pending > 0 ? 'warning' : 'default') as 'warning' | 'default', helper: metrics.pending > 0 ? 'Requieren acción' : 'Al día' },
        { label: 'Evaluaciones completadas', value: metrics.evaluated, icon: <RiCheckboxCircleLine />, variant: 'success' as const },
        { label: 'Estudiantes activos', value: metrics.students, icon: <RiGroupLine />, variant: 'info' as const },
      ];

  const issueItems = operationalIssues
    ? [
        { label: "Asignaciones huérfanas", value: operationalIssues.counts.orphanAssignments, tone: (operationalIssues.counts.orphanAssignments > 0 ? 'danger' : 'idle') as StatusTone },
        { label: "Entregas huérfanas", value: operationalIssues.counts.orphanDeliveries, tone: (operationalIssues.counts.orphanDeliveries > 0 ? 'danger' : 'idle') as StatusTone },
        { label: "Storage sin padre", value: operationalIssues.counts.orphanStorageObjects, tone: (operationalIssues.counts.orphanStorageObjects > 0 ? 'warning' : 'idle') as StatusTone },
        { label: "Asignaciones revocadas", value: operationalIssues.counts.revokedAssignments, tone: 'idle' as StatusTone },
        { label: "Entregas tardías", value: operationalIssues.counts.lateDeliveries, tone: (operationalIssues.counts.lateDeliveries > 0 ? 'warning' : 'idle') as StatusTone },
        { label: "Sin nota", value: operationalIssues.counts.ungradedEvaluatedDeliveries, tone: (operationalIssues.counts.ungradedEvaluatedDeliveries > 0 ? 'warning' : 'idle') as StatusTone },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de Control"
        subtitle="Resumen operativo de proyectos, entregas y estado del sistema."
        icon={<RiStackLine />}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => navigate("/deliveries")}>
              Ver entregas
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/projects")}>
              <RiAddLine className="text-base" />
              Nuevo proyecto
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-app-border bg-white py-12 text-slate-500">
          <RiLoader4Line className="animate-spin text-xl" />
          Cargando dashboard...
        </div>
      ) : (
        <>
          <StatsOverview stats={globalStats} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <SectionCard title="Métricas de Cohorte" description="Rendimiento del proyecto seleccionado">
                <CohortAnalyticsDashboard
                  initialProjectId={selection.projectId}
                  projects={recentProjects}
                  onSelectProject={(id) => {
                    const proj = recentProjects.find((p) => p.id === id);
                    if (proj) setProject(proj.id, proj.title);
                  }}
                />
              </SectionCard>

              <section className="rounded-lg border border-app-border bg-white p-4">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Auditoría de Integridad</h3>
                    <p className="text-xs text-slate-500">
                      Diagnóstico del grafo de datos y consistencia operativa.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleValidateResources()}
                      disabled={syncing !== null}
                    >
                      {syncing === "dry-run" ? <RiLoader4Line className="animate-spin" /> : <RiShieldCheckLine />}
                      Validar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setConfirmSyncOpen(true)}
                      disabled={syncing !== null}
                    >
                      <RiRefreshLine className={syncing === "apply" ? "animate-spin" : ""} />
                      Sincronizar
                    </Button>
                  </div>
                </div>

                {operationalIssues ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {issueItems.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between rounded-md border border-app-border bg-slate-50 px-3 py-2"
                        >
                          <span className="text-xs font-medium text-slate-600">{item.label}</span>
                          <StatusBadge tone={item.tone}>{item.value}</StatusBadge>
                        </div>
                      ))}
                    </div>

                    {operationalIssues.issues.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Incidencias destacadas
                        </h4>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {operationalIssues.issues.map((issue) => (
                            <div
                              key={issue.id}
                              className="rounded-md border border-app-border bg-white p-3"
                            >
                              <div className="mb-1 flex items-start justify-between gap-3">
                                <span className="text-sm font-medium text-slate-900">{issue.title}</span>
                                <StatusBadge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                                  {issue.severity === 'error' ? 'Crítico' : 'Aviso'}
                                </StatusBadge>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2">{issue.detail}</p>
                              <div className="mt-2 text-[10px] text-slate-400">
                                {issue.category} {issue.projectTitle ? `· ${issue.projectTitle}` : ""}
                                {issue.createdAt && ` · ${new Date(issue.createdAt).toLocaleString("es-ES")}`}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    No se pudieron cargar las métricas de integridad.
                  </div>
                )}

                {syncPreview && (
                  <div className="mt-5 rounded-md border border-app-border bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Resultado del análisis ({syncPreview.mode})
                      </h4>
                      <StatusBadge tone="info">{syncPreview.actions.length} acciones</StatusBadge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {(["orphanAssignments", "orphanDeliveries", "orphanStorageObjects"] as const).map((category) => (
                        <div key={category} className="rounded-md border border-app-border bg-white p-3">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">{category}</div>
                          <div className="text-lg font-semibold text-slate-900">
                            {syncPreview.applied[category]} / {syncPreview.matched[category]}
                          </div>
                          <div className="text-xs text-slate-400">Aplicadas / Detectadas</div>
                        </div>
                      ))}
                    </div>
                    {syncPreview.actions.length > 0 && (
                      <div className="mt-3 max-h-60 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-xs">
                          <thead className="bg-white">
                            <tr className="border-b border-app-border">
                              <th className="px-2 py-1.5 text-left font-medium text-slate-500">Acción</th>
                              <th className="px-2 py-1.5 text-left font-medium text-slate-500">Categoría</th>
                              <th className="px-2 py-1.5 text-left font-medium text-slate-500">Resultado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {syncPreview.actions.map((action, idx) => (
                              <tr key={`${action.targetId}-${idx}`}>
                                <td className="px-2 py-2 text-slate-700">{action.action}</td>
                                <td className="px-2 py-2 text-slate-500">{action.category}</td>
                                <td className="px-2 py-2">
                                  <StatusBadge
                                    tone={
                                      (action.outcome === 'applied'
                                        ? 'success'
                                        : action.outcome === 'would_apply'
                                          ? 'info'
                                          : 'idle') as StatusTone
                                    }
                                  >
                                    {action.outcome}
                                  </StatusBadge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-5">
              {selection.projectId && (
                <SectionCard title="Contexto activo">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary">
                      <RiFolderOpenLine className="text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {selection.projectTitle || "Proyecto seleccionado"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Filtros sincronizados en entregas y runtime.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => navigate("/projects")}>
                          Gestionar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate("/runtime")}>
                          <RiPulseLine className="text-base" />
                          Runtime
                        </Button>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Prioridades" headerAction={
                <Button variant="ghost" size="sm" onClick={() => navigate("/deliveries")}>
                  Ver todo <RiArrowRightLine />
                </Button>
              }>
                {pendingDeliveries.length > 0 && (
                  <div className="mb-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <RiInboxArchiveLine className="text-amber-500" />
                      {metrics.pending} entregas por revisar
                    </div>
                    <div className="space-y-2">
                      {pendingDeliveries.slice(0, 4).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleDeliveryClick(d)}
                          className="group flex w-full items-center justify-between rounded-md border border-app-border bg-white p-2.5 text-left transition-colors hover:border-primary/30 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-900">
                              v{d.version} · {d.projectTitle}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">{d.studentEmail}</p>
                          </div>
                          <RiArrowRightLine className="shrink-0 text-slate-400 transition group-hover:text-primary group-hover:translate-x-0.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {recentEvaluated.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <RiCheckboxCircleLine className="text-emerald-500" />
                      Últimas evaluaciones
                    </div>
                    <div className="space-y-2">
                      {recentEvaluated.slice(0, 3).map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleDeliveryClick(d)}
                          className="group flex w-full items-center justify-between rounded-md border border-app-border bg-white p-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-900">{d.studentEmail}</p>
                            <p className="truncate text-[10px] text-slate-500">
                              v{d.version} · {d.projectTitle}
                            </p>
                          </div>
                          <StatusBadge tone="success">Evaluada</StatusBadge>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDeliveries.length === 0 && recentEvaluated.length === 0 && (
                  <EmptyState
                    icon={<RiShieldCheckLine className="text-2xl text-slate-400" />}
                    title="Todo al día"
                    description="No hay entregas pendientes ni evaluaciones recientes."
                  />
                )}
              </SectionCard>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Proyectos recientes</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
                Ver catálogo <RiArrowRightLine />
              </Button>
            </div>
            {recentProjects.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleProjectClick(p)}
                    className="group flex flex-col rounded-lg border border-app-border bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-slate-50"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                        <RiFolderOpenLine className="text-base" />
                      </div>
                      <RiArrowRightLine className="text-slate-400 transition group-hover:text-primary group-hover:translate-x-0.5" />
                    </div>
                    <p className="mb-1 truncate text-sm font-medium text-slate-900 group-hover:text-primary">
                      {p.title}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      <span className="text-xs text-slate-500">
                        {p.status === 'ACTIVE' ? 'En curso' : 'Finalizado'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No hay proyectos"
                description="Crea el primer proyecto para empezar a gestionar entregas."
                actionLabel="Crear proyecto"
                onAction={() => navigate("/projects")}
              />
            )}
          </section>
        </>
      )}

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
