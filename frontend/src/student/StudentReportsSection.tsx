import { useEffect, useMemo, useState } from "react";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiFileList3Line,
  RiFileTextLine,
  RiInboxArchiveLine,
  RiLineChartLine,
} from "react-icons/ri";

import { builderApi } from "../shared/api/builderApi";
import { EmptyState } from "../shared/components/EmptyState";
import { MetricCard } from "../shared/components/MetricCard";
import { Skeleton, SkeletonCard } from "../shared/components/Skeleton";
import { Button } from "../shared/components/ui/Button";
import type {
  BuildRunEntity,
  DeliveryEntity,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { EvaluationProgressCard } from "./components/EvaluationProgressCard";
import { StudentSurface, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { resolveStudentRunOutcome } from "./studentWorkspaceInsights";
import { ReportView } from "../shared/components/ReportView";

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
  session: SessionRecord | null;
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
              ? "bg-emerald-400"
              : "bg-rose-400";

          return (
            <div
              key={delivery.id}
              className={`flex min-w-[3.5rem] flex-col items-center ${
                isLatest ? "opacity-100" : "opacity-70"
              }`}
            >
              <span className="text-xs font-semibold text-slate-900">
                {grade.toFixed(1)}
              </span>
              <div className="mt-2 flex h-24 items-end">
                <div
                  className={`w-9 rounded-t-lg ${color}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="mt-2 text-[11px] font-semibold uppercase text-slate-400">
                v{delivery.version}
              </span>
            </div>
          );
        })}
      </div>
    </StudentSurface>
  );
}

function DeliveryStatusBadge({
  delivery,
  summaryRun,
}: {
  delivery: DeliveryEntity;
  summaryRun: BuildRunEntity | null;
}) {
  const outcome = resolveStudentRunOutcome(summaryRun);

  if (delivery.grade !== null) {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Nota {delivery.grade.toFixed(2)}
      </span>
    );
  }

  if (!summaryRun) {
    return (
      <span className="inline-flex rounded-full border border-app-border/30 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
        Sin evaluación
      </span>
    );
  }

  if (outcome === "PASS") {
    return (
      <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        Apto
      </span>
    );
  }

  if (outcome === "FAIL") {
    return (
      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
        No apto
      </span>
    );
  }

  if (outcome === "PARTIAL") {
    return (
      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        Necesita mejoras
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
      En seguimiento
    </span>
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
    <div className="overflow-hidden rounded-lg border border-app-border bg-white">
      <button
        className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition hover:bg-slate-50/20"
        onClick={() => setIsOpen((previous) => !previous)}
      >
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-primary">
            <RiFileTextLine className="text-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold text-slate-900">
                Entrega v{delivery.version}
              </h4>
              <DeliveryStatusBadge delivery={delivery} summaryRun={summaryRun} />
              {delivery.isLate ? (
                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Fuera de plazo
                </span>
              ) : null}
            </div>
            <div className="mt-2 text-sm text-slate-500">
              {delivery.projectTitle ?? "Proyecto"} ·{" "}
              {new Date(delivery.createdAt).toLocaleString("es-ES")}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
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
        <div className="shrink-0 pt-1 text-slate-400">
          {isOpen ? <RiArrowUpSLine className="text-2xl" /> : <RiArrowDownSLine className="text-2xl" />}
        </div>
      </button>

      {isOpen ? (
        <div className="border-t border-app-border bg-slate-50/50 px-6 py-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-lg border border-app-border bg-white p-4">
              <div className="ui-label text-slate-400">Estado de entrega</div>
              <div className="mt-3 text-sm font-semibold text-slate-900">
                {delivery.isLate ? "Registrada fuera de plazo" : "Registrada dentro de plazo"}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {delivery.isLate
                  ? "La versión queda guardada como tardía, pero sigue disponible para revisión técnica y académica."
                  : "La versión quedó registrada dentro de la ventana prevista para la práctica."}
              </p>
            </article>
            <article className="rounded-lg border border-app-border bg-white p-4">
              <div className="ui-label text-slate-400">Observaciones docentes</div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                {delivery.graderNotes ||
                  "Todavía no hay observaciones manuales del profesorado para esta versión."}
              </p>
            </article>
            <article className="rounded-lg border border-app-border bg-white p-4">
              <div className="ui-label text-slate-400">Trayectoria de la versión</div>
              <p className="mt-3 text-sm leading-6 text-slate-500">
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
                    className="rounded-lg border border-app-border bg-white p-4"
                  >
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
                    <div className="mt-4 h-5 w-32 animate-pulse rounded bg-slate-50/60" />
                    <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-50/60" />
                  </div>
                ))}
              </div>
              <SkeletonCard />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Error: {error}
            </div>
          ) : !run ? (
            <div className="rounded-lg border border-app-border/30 bg-white px-4 py-6 text-center text-sm text-slate-500">
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

export function StudentReportsSection({ session, data }: Props): JSX.Element {
  const { selection } = useWorkspace();
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
  const defaultProjectId = sortedDeliveries[0]?.projectId ?? assignments[0]?.projectId ?? null;
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
        <div className="rounded-lg border border-app-border bg-white p-6">
          <Skeleton type="text" className="h-6 w-52 bg-slate-50" />
          <Skeleton type="text" className="mt-4 h-4 w-3/4 bg-slate-50/60" />
        </div>
        {[1, 2].map((index) => (
          <SkeletonCard key={index} />
        ))}
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

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<RiInboxArchiveLine className="text-4xl text-slate-400/40" />}
        title="Aún no hay informes"
        description="Cuando registres tu primera entrega, esta vista reunirá el historial técnico, las observaciones docentes y el coaching para la siguiente versión."
      />
    );
  }

  const remaining = filteredDeliveries.length - displayLimit;

  return (
    <div className="space-y-6">
      {/* 1. Project Selector Section */}
      <div className="rounded-lg border border-app-border bg-white p-6">
        <h3 className="text-xs font-semibold uppercase text-slate-400 mb-4">
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
                    : "border-app-border bg-white hover:border-slate-300"
                }`}
              >
                {/* Accent indicator bar on the left */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    isSelected ? "bg-primary" : "bg-transparent"
                  }`}
                />
                
                <div className="pl-2">
                  <h4 className={`text-sm font-semibold text-slate-900 ${
                    isSelected ? "text-primary" : ""
                  }`}>
                    {project.title}
                  </h4>
                  
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <span className="text-xs font-medium text-slate-500">
                      {projectDeliveries.length === 0
                        ? "Sin entregas"
                        : projectDeliveries.length === 1
                          ? "1 entrega"
                          : `${projectDeliveries.length} entregas`}
                    </span>
                    
                    {latestDelivery && (
                      <DeliveryStatusBadge
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
              session={session}
              historicalMedianMs={historicalMedianMs}
            />
          ) : null}

          {filteredDeliveries.length > 1 && (
            <GradeTimeline deliveries={filteredDeliveries} />
          )}

          <div className="space-y-4">
            {filteredDeliveries.length === 0 ? (
              <div className="rounded-lg border border-dashed border-app-border bg-white px-6 py-12 text-center text-slate-500">
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
