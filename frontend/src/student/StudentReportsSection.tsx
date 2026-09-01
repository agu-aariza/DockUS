/**
 * @fileoverview Panel y vista del espacio del alumno (StudentReportsSection).
 *
 * @module StudentReportsSection
 */

import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiFileList3Line,
  RiFileTextLine,
  RiInboxArchiveLine,
  RiLineChartLine,
} from "react-icons/ri";

import { builderApi } from "../builder/api/builderApi";
import { EmptyState } from "../shared/components/EmptyState";
import { MetricCard } from "../shared/components/MetricCard";
import { Skeleton, SkeletonCard } from "../shared/components/Skeleton";
import { Button } from "../shared/components/ui/Button";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import type { BuildRunEntity } from "../features/builder/types";
import type { DeliveryEntity } from "../features/deliveries/types";
import { getErrorMessage } from "../shared/utils/errors";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import { EvaluationProgressCard } from "./components/EvaluationProgressCard";
import { StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { DeliveryOutcomeBadge } from "../features/deliveries/components/DeliveryOutcomeBadge";
import { resolveStudentRunOutcome } from "./studentWorkspaceInsights";
import { ReportView } from "../reporting/components/ReportView";

function computeMedianDurationMs(
  runs: BuildRunEntity[],
): number | null {
  const durations = runs
    .map((run) => {
      if (!run.startedAt || !run.finishedAt) {
        return null;
      }
      const duration =
        new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
      return duration > 0 ? duration : null;
    })
    .filter((duration): duration is number => duration !== null)
    .sort((left, right) => left - right);

  if (durations.length === 0) {
    return null;
  }

  const middle = Math.floor(durations.length / 2);
  if (durations.length % 2 === 1) {
    return durations[middle];
  }

  return Math.round((durations[middle - 1] + durations[middle]) / 2);
}

interface Props {
  data: StudentWorkspaceData;
}

function GradeTimeline({ deliveries }: { deliveries: DeliveryEntity[] }) {
  const graded = deliveries
    .filter((delivery) => delivery.grade !== null)
    .sort((left, right) => left.version - right.version);

  if (graded.length < 2) {
    return null;
  }

  return (
    <StudentSurface tone="subtle">
      <StudentSurfaceHeader
        eyebrow="Evolución académica"
        title="Cómo han cambiado tus notas"
        description="Esta línea temporal te permite ver si tus iteraciones están convergiendo o si la práctica sigue atascada en los mismos bloqueos."
      />
      <div className="mt-6 flex items-end gap-3 overflow-x-auto pb-2">
        {graded.map((delivery, index) => {
          const grade = delivery.grade as number;
          const heightPct = Math.max(12, Math.round((grade / 10) * 100));
          const isLatest = index === graded.length - 1;
          const color =
            grade >= 5
              ? "bg-success-400"
              : "bg-danger";

          return (
            <div
              key={delivery.id}
              className={`flex min-w-[3.5rem] flex-col items-center ${
                isLatest ? "opacity-100" : "opacity-70"
              }`}
            >
              <span className="text-xs font-semibold text-app-text">
                {grade.toFixed(1)}
              </span>
              <div className="mt-2 flex h-24 items-end">
                <div
                  className={`w-9 rounded-t-lg ${color}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="mt-2 text-[11px] font-semibold uppercase text-app-text-muted">
                v{delivery.version}
              </span>
            </div>
          );
        })}
      </div>
    </StudentSurface>
  );
}

function ReportContainer({
  delivery,
  summaryRun,
  defaultOpen = false,
}: {
  delivery: DeliveryEntity;
  summaryRun: BuildRunEntity | null;
  defaultOpen?: boolean;
}) {
  const [run, setRun] = useState<BuildRunEntity | null>(summaryRun);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [hasLoaded, setHasLoaded] = useState(Boolean(summaryRun));

  const summaryRunId = summaryRun?.id ?? null;
  useEffect(() => {
    if (summaryRun && run && summaryRun.id !== run.id) {
      setRun(summaryRun);
      setHasLoaded(false);
    } else if (summaryRun && !run) {
      setRun(summaryRun);
    }
  }, [summaryRunId]);

  useEffect(() => {
    if (!isOpen || hasLoaded) {
      return;
    }

    async function loadReport() {
      setLoading(true);
      setError(null);
      try {
        const response = await builderApi.listByDelivery({
          deliveryId: delivery.id,
          limit: 1,
          sortOrder: "DESC",
        });
        if (response.data.length > 0) {
          const fullRun = await builderApi.detail(response.data[0].id);
          setRun(fullRun);
        } else {
          setRun(null);
        }
        setHasLoaded(true);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, [delivery.id, hasLoaded, isOpen]);

  const outcome = resolveStudentRunOutcome(run ?? summaryRun);
  const coaching = run?.report?.coaching ?? summaryRun?.report?.coaching ?? null;

  return (
    <div className="overflow-hidden rounded-lg border border-app-border bg-app-surface">
      <button
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-app-bg-subtle/20"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-app-bg-subtle text-primary">
            <RiFileTextLine className="text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold text-app-text">
                Entrega v{delivery.version}
              </h4>
              <DeliveryOutcomeBadge delivery={delivery} summaryRun={summaryRun} />
              {delivery.isLate ? (
                <StatusBadge tone="warning">Fuera de plazo</StatusBadge>
              ) : null}
            </div>
            <div className="mt-2 data-meta">
              {delivery.projectTitle} ·{" "}
              {new Date(delivery.createdAt).toLocaleString("es-ES")}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-app-text-secondary">
              {coaching
                ? coaching.passReadiness === "BLOCKED"
                  ? "El informe detecta bloqueos claros antes de poder pasar. Abre el expediente para ver coaching, evidencia y checklist."
                  : "La entrega ya supera lo esencial y el informe se centra en mejoras de calidad, mantenibilidad y rubric compliance."
                : summaryRun
                  ? outcome === "PASS"
                    ? "La versión tiene un resultado técnico positivo y puedes abrir el informe para revisar evidencia y mejoras opcionales."
                    : "La versión ya tiene resultado técnico asociado. Abre el informe para revisar evidencia, límites y siguientes pasos."
                  : "Todavía no hay un informe técnico completo asociado a esta entrega."}
            </p>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-app-text-muted">
          {isOpen ? <RiArrowUpSLine className="text-2xl" /> : <RiArrowDownSLine className="text-2xl" />}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-app-border bg-app-bg-subtle/50 px-6 py-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="ui-label">Estado de entrega</div>
              <div className="mt-3 text-sm font-semibold text-app-text">
                {delivery.isLate ? "Registrada fuera de plazo" : "Registrada dentro de plazo"}
              </div>
              <p className="mt-2 text-sm leading-6 text-app-text-secondary">
                {delivery.isLate
                  ? "La versión queda guardada como tardía, pero sigue disponible para revisión técnica y académica."
                  : "La versión quedó registrada dentro de la ventana prevista para la práctica."}
              </p>
            </article>
            <article className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="ui-label">Observaciones docentes</div>
              <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                {delivery.graderNotes ||
                  "Todavía no hay observaciones manuales del profesorado para esta versión."}
              </p>
            </article>
            <article className="rounded-lg border border-app-border bg-app-surface p-4">
              <div className="ui-label">Trayectoria de la versión</div>
              <p className="mt-3 text-sm leading-6 text-app-text-secondary">
                {coaching
                  ? `${coaching.mustFix.length} bloqueo(s), ${coaching.shouldImprove.length} mejora(s) y ${coaching.strengths.length} fortaleza(s) detectadas.`
                  : summaryRun
                    ? "Existe un run técnico asociado listo para abrir."
                    : "Aún no hay run técnico completo para esta entrega."}
              </p>
            </article>
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-app-border bg-app-surface p-4"
                  >
                    <div className="h-3 w-24 animate-pulse rounded bg-app-bg-subtle" />
                    <div className="mt-4 h-5 w-32 animate-pulse rounded bg-app-bg-subtle/60" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-app-bg-subtle/60" />
                  </div>
                ))}
              </div>
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger-800 dark:text-danger-300">
              Error: {error}
            </div>
          ) : !run ? (
            <div className="rounded-lg border border-app-border/30 bg-app-surface px-4 py-6 text-center text-sm text-app-text-muted">
              Esta entrega aún no tiene un informe técnico disponible.
            </div>
          ) : (
            <ReportView run={run} deliveryVersion={delivery.version} mode="student" />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StudentReportsSection({ data }: Props): JSX.Element {
  const { selection } = useWorkspaceSelection();
  const { assignments, deliveries, latestRunByDeliveryId, loading, error } = data;
  const [displayLimit, setDisplayLimit] = useState(10);

  // Group and sort deliveries
  const sortedDeliveries = useMemo(
    () =>
      [...deliveries].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [deliveries],
  );

  // Extract unique projects from assignments and deliveries
  const projects = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    
    // 1. Load from assigned projects
    assignments.forEach((asg) => {
      map.set(asg.projectId, { id: asg.projectId, title: asg.projectTitle });
    });
    
    // 2. Load from deliveries (fallback)
    deliveries.forEach((d) => {
      if (d.projectId && !map.has(d.projectId)) {
        map.set(d.projectId, { id: d.projectId, title: d.projectTitle || "Proyecto sin título" });
      }
    });
    
    return Array.from(map.values());
  }, [assignments, deliveries]);

  // Selected project state
  const defaultProjectId = sortedDeliveries[0]?.projectId ?? assignments[0]?.projectId;
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaultProjectId);

  // Update selected project when workspace selection changes
  useEffect(() => {
    if (selection.projectId) {
      setSelectedProjectId(selection.projectId);
    }
  }, [selection.projectId]);

  // Filter deliveries and active run by selected project
  const filteredDeliveries = useMemo(() => {
    if (!selectedProjectId) return [];
    return sortedDeliveries.filter((d) => d.projectId === selectedProjectId);
  }, [sortedDeliveries, selectedProjectId]);

  const activeEvaluationRun = useMemo(() => {
    if (!selectedProjectId) return null;
    return filteredDeliveries
      .map((delivery) => latestRunByDeliveryId[delivery.id] ?? null)
      .find((run) => Boolean(run && !run.isTerminal)) ?? null;
  }, [filteredDeliveries, latestRunByDeliveryId, selectedProjectId]);

  // Compute stats and insights for selected project
  const currentProjectInsights = useMemo(() => {
    if (!selectedProjectId) {
      return {
        reportsReady: 0,
        blockedReports: 0,
        officialGrades: 0,
        pendingEvaluations: 0,
      };
    }
    
    const projectDeliveries = filteredDeliveries;
    const reportsReady = projectDeliveries.filter((d) => {
      const run = latestRunByDeliveryId[d.id];
      return run && run.status === "SUCCESS";
    }).length;
    
    const blockedReports = projectDeliveries.filter((d) => {
      const run = latestRunByDeliveryId[d.id];
      return run && run.report?.coaching?.passReadiness === "BLOCKED";
    }).length;

    const gradedDeliveries = projectDeliveries.filter((d) => d.grade !== null);
    const officialGrades = gradedDeliveries.length;
    const pendingEvaluations = projectDeliveries.filter((d) => {
      const run = latestRunByDeliveryId[d.id];
      return run && !run.isTerminal;
    }).length;

    return {
      reportsReady,
      blockedReports,
      officialGrades,
      pendingEvaluations,
    };
  }, [filteredDeliveries, latestRunByDeliveryId, selectedProjectId]);

  const historicalMedianMs = computeMedianDurationMs(
    Object.values(latestRunByDeliveryId)
      .filter((run): run is BuildRunEntity => Boolean(run))
      .slice(0, 10),
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-app-border bg-app-surface p-6">
          <Skeleton type="text" className="h-6 w-52" />
          <Skeleton type="text" className="mt-4 h-4 w-3/4" />
        </div>
        {[1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-danger-800 dark:text-danger-300">
        Error: {error}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxArchiveLine className="text-4xl text-app-text-muted/40" />}
        title="Aún no hay informes"
        description="Cuando registres tu primera entrega, esta vista reunirá el historial técnico, las observaciones docentes y el coaching para la siguiente versión."
      />
    );
  }

  const remaining = filteredDeliveries.length - displayLimit;

  return (
    <div className="space-y-6">
      {/* 1. Project Selector Section */}
      <div className="rounded-lg border border-app-border bg-app-surface p-6">
        <h3 className="ui-label mb-4">
          Selecciona un Proyecto
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const isSelected = selectedProjectId === project.id;
            const projectDeliveries = sortedDeliveries.filter((d) => d.projectId === project.id);
            const latestDelivery = projectDeliveries[0] ?? null;
            const latestRun = latestDelivery ? (latestRunByDeliveryId[latestDelivery.id] ?? null) : null;
            
            return (
              <button
                key={project.id}
                onClick={() => {
                  setSelectedProjectId(project.id);
                  setDisplayLimit(10);
                }}
                className={`relative text-left rounded-lg border p-5 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary-subtle"
                    : "border-app-border bg-app-surface hover:border-app-text-muted/40"
                }`}
              >
                {/* Accent indicator bar on the left */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isSelected ? "bg-primary" : "bg-transparent"
                  }`}
                />

                <div className="pl-2">
                  <h4 className={`text-sm font-semibold text-app-text ${
                    isSelected ? "text-primary" : ""
                  }`}>
                    {project.title}
                  </h4>

                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="text-xs font-medium text-app-text-muted">
                      {projectDeliveries.length === 0
                        ? "Sin entregas"
                        : projectDeliveries.length === 1
                          ? "1 entrega"
                          : `${projectDeliveries.length} entregas`}
                    </span>
                    
                    {latestDelivery && (
                      <DeliveryOutcomeBadge
                        delivery={latestDelivery}
                        summaryRun={latestRun}
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selected Project Panel */}
      {selectedProject && (
        <div className="space-y-6">
          <StudentSurface tone="accent">
            <StudentSurfaceHeader
              eyebrow="Archivo técnico"
              title={`Expediente de ${selectedProject.title}`}
              description="Aquí puedes revisar el historial de tus entregas, los informes de evaluación automáticos y las calificaciones oficiales de este proyecto específico."
              actions={
                <Button variant="secondary" onClick={() => setDisplayLimit(10)}>
                  Reiniciar lista
                </Button>
              }
            />
            
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              <MetricCard
                label="Entregas"
                value={filteredDeliveries.length}
                helper="Versiones enviadas"
                icon={<RiInboxArchiveLine />}
                variant="default"
              />
              <MetricCard
                label="Informes listos"
                value={currentProjectInsights.reportsReady}
                helper={`${currentProjectInsights.blockedReports} con bloqueos`}
                icon={<RiFileTextLine />}
                variant={currentProjectInsights.blockedReports > 0 ? "warning" : "success"}
              />
              <MetricCard
                label="Notas oficiales"
                value={currentProjectInsights.officialGrades}
                helper={
                  filteredDeliveries.find((d) => d.grade !== null)
                    ? `Nota actual: ${filteredDeliveries.find((d) => d.grade !== null)?.grade?.toFixed(2)}`
                    : "Sin nota oficial aún"
                }
                icon={<RiLineChartLine />}
                variant={filteredDeliveries.find((d) => d.grade !== null) ? "success" : "default"}
              />
              <MetricCard
                label="Pendientes"
                value={currentProjectInsights.pendingEvaluations}
                helper="Runs aún en seguimiento"
                icon={<RiFileList3Line />}
                variant={currentProjectInsights.pendingEvaluations > 0 ? "info" : "default"}
              />
            </div>
          </StudentSurface>

          {activeEvaluationRun ? (
            <EvaluationProgressCard
              run={activeEvaluationRun}
              historicalMedianMs={historicalMedianMs}
            />
          ) : null}

          {filteredDeliveries.length > 1 && (
            <GradeTimeline deliveries={filteredDeliveries} />
          )}

          <div className="space-y-4">
            {filteredDeliveries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-app-border bg-app-surface px-6 py-12 text-center text-app-text-muted">
                <RiInboxArchiveLine className="mx-auto text-4xl opacity-30 mb-2" />
                <p className="text-sm font-semibold">No se han registrado entregas para este proyecto.</p>
                <p className="text-xs opacity-75 mt-1">Utiliza el espacio de trabajo para subir tu código e iniciar la evaluación del sandbox.</p>
              </div>
            ) : (
              filteredDeliveries.slice(0, displayLimit).map((delivery) => (
                <ReportContainer
                  key={delivery.id}
                  delivery={delivery}
                  summaryRun={latestRunByDeliveryId[delivery.id] ?? null}
                  defaultOpen={
                    selection.deliveryId === delivery.id || filteredDeliveries.length === 1
                  }
                />
              ))
            )}
          </div>

          {remaining > 0 ? (
            <Button
              variant="secondary"
              className="w-full justify-center"
              onClick={() => setDisplayLimit((previous) => previous + 10)}
            >
              Mostrar más ({remaining} restantes)
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
