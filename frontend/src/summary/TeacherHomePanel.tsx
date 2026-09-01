/**
 * @fileoverview Panel de resumen y analíticas generales docentes (TeacherHomePanel).
 *
 * @module TeacherHomePanel
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RiPulseLine,
  RiFolderOpenLine,
  RiArrowRightLine,
  RiAddLine,
} from "react-icons/ri";
import type {
  ProjectEntity,
  ProjectOperationalIssuesReconcileResult as ProjectOperationalIssuesSyncResult,
} from "../features/projects/types";
import type { DeliveryEntity } from "../features/deliveries/types";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import { projectsApi } from "../projects/api/projectsApi";
import { deliveriesApi } from "../deliveries/api/deliveriesApi";
import { usersApi } from "../users/api/usersApi";
import { queryKeys } from "../shared/query/queryKeys";
import { CohortAnalyticsDashboard } from "./components/CohortAnalyticsDashboard";
import { CourseStatusStrip, CourseStatusStripSkeleton } from "./components/CourseStatusStrip";
import { ReviewQueue } from "./components/ReviewQueue";
import { IntegrityAudit } from "./components/IntegrityAudit";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { useToast } from "../shared/toast/ToastContext";
import { getErrorMessage } from "../shared/utils/errors";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { SectionCard } from "../shared/components/ui/Layout";
import { EmptyState } from "../shared/components/EmptyState";

export function TeacherHomePanel(): JSX.Element {
  const { selection, setProject, setDelivery } = useWorkspaceSelection();
  const navigate = useNavigate();
  const { pushToast } = useToast();

  const queryClient = useQueryClient();
  const [syncPreview, setSyncPreview] = useState<ProjectOperationalIssuesSyncResult | null>(null);
  const [syncing, setSyncing] = useState<"dry-run" | "apply" | null>(null);
  const [confirmSyncOpen, setConfirmSyncOpen] = useState(false);

  // 5 queries independientes en vez de un Promise.all: cada una falla o carga
  // por su cuenta (antes, 4 de las 5 llevaban su propio .catch() para lograr
  // justo esto; con React Query es el comportamiento natural, no hace falta
  // simularlo). Son previews de dashboard con params fijos y bajos (limit 4/5),
  // distintos de las listas paginadas de sus dominios — de ahí keys propias.
  const recentProjectsQuery = useQuery({
    queryKey: queryKeys.summary.recentProjects(),
    queryFn: () => projectsApi.list({ limit: 4, sortOrder: "DESC" }),
  });
  const pendingDeliveriesQuery = useQuery({
    queryKey: queryKeys.summary.pendingDeliveries(),
    queryFn: () => deliveriesApi.list({ limit: 5, status: "SUBMITTED", sortOrder: "DESC" }),
  });
  const recentEvaluatedQuery = useQuery({
    queryKey: queryKeys.summary.recentEvaluated(),
    queryFn: () => deliveriesApi.list({ limit: 5, status: "EVALUATED", sortOrder: "DESC" }),
  });
  const studentsCountQuery = useQuery({
    queryKey: queryKeys.summary.studentsCount(),
    queryFn: () => usersApi.list({ role: "STUDENT", limit: 1 }),
  });
  const operationalIssuesQuery = useQuery({
    queryKey: queryKeys.summary.operationalIssues(),
    queryFn: () => projectsApi.getOperationalIssues(),
  });

  const recentProjects: ProjectEntity[] = recentProjectsQuery.data?.data ?? [];
  const pendingDeliveries: DeliveryEntity[] = pendingDeliveriesQuery.data?.data ?? [];
  const recentEvaluated: DeliveryEntity[] = recentEvaluatedQuery.data?.data ?? [];
  const metrics = {
    projects: recentProjectsQuery.data?.meta.total ?? 0,
    pending: pendingDeliveriesQuery.data?.meta.total ?? 0,
    evaluated: recentEvaluatedQuery.data?.meta.total ?? 0,
    students: studentsCountQuery.data?.meta.total ?? 0,
  };
  const operationalIssues = operationalIssuesQuery.data ?? null;
  const loading =
    recentProjectsQuery.isPending ||
    pendingDeliveriesQuery.isPending ||
    recentEvaluatedQuery.isPending ||
    studentsCountQuery.isPending ||
    operationalIssuesQuery.isPending;

  const refreshDashboard = () =>
    Promise.all([
      recentProjectsQuery.refetch(),
      pendingDeliveriesQuery.refetch(),
      recentEvaluatedQuery.refetch(),
      studentsCountQuery.refetch(),
      operationalIssuesQuery.refetch(),
    ]);

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
      // La reconciliación puede archivar asignaciones/entregas huérfanas y
      // limpiar storage sin padre válido: invalida ampliamente los dominios
      // afectados, no solo las previews de este dashboard.
      await Promise.all([
        refreshDashboard(),
        queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.storage.all }),
      ]);
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

  const statusReadings = [
    {
      label: "Por revisar",
      value: metrics.pending,
      helper: metrics.pending > 0 ? "Requieren tu acción" : "Al día",
      alert: metrics.pending > 0,
    },
    { label: "Evaluadas", value: metrics.evaluated, helper: "Con informe emitido" },
    { label: "Proyectos", value: metrics.projects, helper: "En el catálogo" },
    { label: "Estudiantes", value: metrics.students, helper: "Con acceso activo" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Panel de control"
        subtitle="Lo que espera revisión, cómo va la cohorte y el estado del sistema."
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
        <CourseStatusStripSkeleton />
      ) : (
        <>
          <CourseStatusStrip readings={statusReadings} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ReviewQueue
                pending={pendingDeliveries}
                evaluated={recentEvaluated.slice(0, 3)}
                pendingTotal={metrics.pending}
                onOpenDelivery={handleDeliveryClick}
                onSeeAll={() => navigate("/deliveries")}
              />
            </div>

            <div className="space-y-6">
              {selection.projectId && (
                <SectionCard title="Contexto activo">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
                      <RiFolderOpenLine className="text-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {selection.projectTitle || "Proyecto seleccionado"}
                      </p>
                      <p className="text-sm text-slate-500">
                        Filtra las entregas y el runtime.
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

              <SectionCard
                title="Proyectos recientes"
                headerAction={
                  <Button variant="ghost" size="sm" onClick={() => navigate("/projects")}>
                    Ver catálogo <RiArrowRightLine />
                  </Button>
                }
              >
                {recentProjects.length > 0 ? (
                  <ul className="-my-1 divide-y divide-app-border">
                    {recentProjects.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => handleProjectClick(p)}
                          className="group flex w-full items-center gap-3 py-2.5 text-left"
                        >
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${p.status === 'ACTIVE' ? 'bg-success' : 'bg-slate-300'}`}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 group-hover:text-accent">
                            {p.title}
                          </span>
                          <RiArrowRightLine className="shrink-0 text-slate-300 transition-transform duration-[--motion-standard] group-hover:translate-x-0.5 group-hover:text-accent" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No hay proyectos"
                    description="Crea el primer proyecto para empezar a recibir entregas."
                    actionLabel="Crear proyecto"
                    onAction={() => navigate("/projects")}
                  />
                )}
              </SectionCard>
            </div>
          </div>

          <SectionCard
            title="Métricas de cohorte"
            description="Rendimiento agregado del proyecto seleccionado."
          >
            <CohortAnalyticsDashboard
              initialProjectId={selection.projectId}
              projects={recentProjects}
              onSelectProject={(id) => {
                const proj = recentProjects.find((p) => p.id === id);
                if (proj) setProject(proj.id, proj.title);
              }}
            />
          </SectionCard>

          <IntegrityAudit
            issues={operationalIssues}
            syncPreview={syncPreview}
            syncing={syncing}
            onValidate={() => void handleValidateResources()}
            onRequestSync={() => setConfirmSyncOpen(true)}
          />
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
