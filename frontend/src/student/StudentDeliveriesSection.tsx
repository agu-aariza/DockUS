/**
 * @fileoverview Panel y vista del espacio del alumno (StudentDeliveriesSection).
 *
 * @module StudentDeliveriesSection
 */

import { useMemo, useState } from "react";
import type { DeliveryEntity } from "../features/deliveries/types";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import {
  RiFileTextLine,
  RiFilter3Line,
  RiInboxArchiveLine,
  RiSortAsc,
  RiSortDesc,
  RiUploadCloud2Line,
  RiRocketLine,
  RiLoader4Line,
} from "react-icons/ri";
import { builderApi } from "../builder/api/builderApi";
import { Button } from "../shared/components/ui/Button";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { MetricCard } from "../shared/components/MetricCard";
import { SkeletonTable } from "../shared/components/Skeleton";
import type { StudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";
import { deriveStudentRetryAction } from "./studentRetryActions";
import { StudentSurface } from "./components/StudentWorkspaceSurface";
import { deriveStudentWorkspaceInsights, resolveStudentRunOutcome } from "./studentWorkspaceInsights";
import type { StudentTab } from "./studentTabs";

interface Props {
  data: StudentWorkspaceData;
  onNavigate: (_tab: StudentTab) => void;
}

function renderGradeBadge(grade: number | null): JSX.Element {
  if (grade === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm italic text-app-text-muted">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning-500" />
        </span>
        Pendiente
      </span>
    );
  }

  // Cuatro tramos de nota, no cuatro estados: por eso esto no delega en
  // StatusBadge (success/warning/danger/idle) y conserva su propia escala de
  // color — la distinción entre "9" y "7" importa aquí y ese tono no existe
  // en el sistema de estados.
  let badgeClasses: string;
  if (grade >= 9.0) {
    badgeClasses = "bg-success-100 text-success-800 border border-success-200 dark:bg-success-950 dark:text-success-300 dark:border-success-700";
  } else if (grade >= 7.0) {
    badgeClasses = "bg-success-50 text-success-700 border border-success-200 dark:bg-success-950 dark:text-success-400 dark:border-success-800";
  } else if (grade >= 5.0) {
    badgeClasses = "bg-warning-50 text-warning-700 border border-warning-200 dark:bg-warning-950 dark:text-warning-400 dark:border-warning-800";
  } else {
    badgeClasses = "bg-danger-50 text-danger-700 border border-danger-200 dark:bg-danger-950 dark:text-danger-400 dark:border-danger-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClasses}`}
    >
      {grade.toFixed(2)}
    </span>
  );
}

function renderOutcomeBadge(outcome: ReturnType<typeof resolveStudentRunOutcome>): JSX.Element {
  if (!outcome) {
    return <StatusBadge tone="idle">Sin run</StatusBadge>;
  }

  const tone =
    outcome === "PASS"
      ? "success"
      : outcome === "FAIL"
        ? "danger"
        : outcome === "PARTIAL"
          ? "warning"
          : "idle";

  const label =
    outcome === "PASS"
      ? "Apto"
      : outcome === "FAIL"
        ? "No apto"
        : outcome === "PARTIAL"
          ? "Parcial"
          : "Sin evaluar";

  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function StudentDeliveriesSection({
  data,
  onNavigate,
}: Props): JSX.Element {
  const { setDelivery, setAssignment, setProject } = useWorkspaceSelection();
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
  const { deliveries, assignments, latestRunByDeliveryId, loading, error } = data;

  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const uniqueProjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const delivery of deliveries) {
      const title = delivery.projectTitle;
      if (!seen.has(title)) {
        seen.set(title, title);
      }
    }
    return Array.from(seen.values());
  }, [deliveries]);

  const filteredDeliveries = useMemo(() => {
    let list = deliveries;

    if (projectFilter !== "all") {
      list = list.filter(
        (delivery) => (delivery.projectTitle) === projectFilter,
      );
    }

    return [...list].sort((left, right) => {
      const leftTime = new Date(left.createdAt).getTime();
      const rightTime = new Date(right.createdAt).getTime();
      return sortOrder === "newest" ? rightTime - leftTime : leftTime - rightTime;
    });
  }, [deliveries, projectFilter, sortOrder]);

  const scopedInsights = deriveStudentWorkspaceInsights(
    assignments,
    filteredDeliveries,
    latestRunByDeliveryId,
  );
  const filteredLatestGrade =
    filteredDeliveries.find((delivery) => delivery.grade !== null)?.grade ?? null;

  const handleSelectReport = (delivery: DeliveryEntity) => {
    setDelivery(delivery.id, `v${delivery.version}`);
    onNavigate("informes");
  };

  const handleRetry = (delivery: DeliveryEntity) => {
    const assignment =
      assignments.find((candidate) => candidate.id === delivery.assignmentId) ?? null;
    if (assignment) {
      setProject(assignment.projectId, assignment.projectTitle);
      setAssignment(assignment.id, assignment.projectTitle);
    }
    setDelivery(delivery.id, `v${delivery.version}`);
    onNavigate("subir");
  };

  if (loading) {
    return <SkeletonTable rows={4} />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-subtle p-4 text-danger-800">
        Error: {error}
      </div>
    );
  }

  // Row derivation helper
  function deriveRow(delivery: DeliveryEntity) {
    const assignment =
      assignments.find((candidate) => candidate.id === delivery.assignmentId) ?? null;
    const latestRun = latestRunByDeliveryId[delivery.id] ?? null;
    const workflow = describeStudentWorkflowState(
      deriveStudentWorkflowState({
        assignment,
        delivery,
        latestRun,
      }),
      {
        isLate: delivery.isLate,
        projectTitle: delivery.projectTitle,
      },
    );
    const retryAction = deriveStudentRetryAction(delivery, latestRun);
    const outcome = resolveStudentRunOutcome(latestRun);

    return { workflow, retryAction, latestRun, outcome };
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Versiones"
          value={scopedInsights.totalDeliveries}
          helper={projectFilter !== "all" ? "Con filtro activo" : "En todo tu workspace"}
          icon={<RiInboxArchiveLine />}
          variant="default"
        />
        <MetricCard
          label="Informes listos"
          value={scopedInsights.reportsReady}
          helper={`${scopedInsights.blockedReports} con bloqueos`}
          icon={<RiFileTextLine />}
          variant={scopedInsights.blockedReports > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Pendientes"
          value={scopedInsights.pendingEvaluations}
          helper="Runs aún en seguimiento"
          icon={<RiFilter3Line />}
          variant={scopedInsights.pendingEvaluations > 0 ? "info" : "default"}
        />
        <MetricCard
          label="Última nota"
          value={filteredLatestGrade !== null ? filteredLatestGrade.toFixed(2) : "—"}
          helper={`${scopedInsights.officialGrades} nota(s) oficiales`}
          icon={<RiFileTextLine />}
          variant={filteredLatestGrade !== null ? "success" : "default"}
        />
      </div>

      {deliveries.length > 0 && uniqueProjects.length > 1 ? (
        <StudentSurface tone="subtle" className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-app-text-secondary">
              <RiFilter3Line className="text-base text-primary" />
              Filtra el histórico para comparar prácticas o concentrarte en una sola.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="input-field min-w-[220px]"
              >
                <option value="all">Todos los proyectos</option>
                {uniqueProjects.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                className="min-w-[180px]"
                onClick={() =>
                  setSortOrder((previous) =>
                    previous === "newest" ? "oldest" : "newest",
                  )
                }
              >
                {sortOrder === "newest" ? <RiSortDesc /> : <RiSortAsc />}
                {sortOrder === "newest" ? "Más recientes" : "Más antiguas"}
              </Button>
            </div>
          </div>
        </StudentSurface>
      ) : null}

      {filteredDeliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border/30 bg-app-bg-subtle/20 px-6 py-12 text-center">
          <RiInboxArchiveLine className="mx-auto text-4xl text-app-text-muted/40" />
          <h3 className="mt-4 text-lg font-bold text-app-text">
            Aún no hay entregas
          </h3>
          <p className="mt-2 text-sm text-app-text-secondary">
            No has realizado ninguna entrega para este proyecto.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filteredDeliveries.map((delivery) => {
              const { workflow, retryAction, outcome, latestRun } = deriveRow(delivery);

              return (
                <StudentSurface key={delivery.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="eyebrow">Versión v{delivery.version}</div>
                      <div className="mt-2 text-lg font-semibold text-app-text">
                        {delivery.projectTitle}
                      </div>
                    </div>
                    {renderGradeBadge(delivery.grade)}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusBadge tone={workflow.tone}>{workflow.label}</StatusBadge>
                    {renderOutcomeBadge(outcome)}
                    {delivery.isLate ? (
                      <span className="inline-flex rounded-full border border-warning-100 bg-warning-50/70 px-2.5 py-0.5 text-xs font-semibold text-warning-700">
                        Fuera de plazo
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-4 text-sm leading-6 text-app-text-secondary">
                    {workflow.description}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-app-border bg-app-bg-subtle px-4 py-3">
                      <div className="ui-label">Fecha</div>
                      <div className="mt-2 text-sm font-medium text-app-text">
                        {new Date(delivery.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg border border-app-border bg-app-bg-subtle px-4 py-3">
                      <div className="ui-label">Intentos restantes</div>
                      <div className="mt-2 text-sm font-medium text-app-text">
                        {delivery.remainingDeliveries}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Button variant="secondary" className="w-full" onClick={() => handleSelectReport(delivery)}>
                      <RiFileTextLine />
                      Ver informe
                    </Button>
                    {!latestRun && (
                      <Button
                        variant="primary"
                        className="w-full"
                        disabled={launchingId === delivery.id}
                        onClick={() => handleLaunchEvaluation(delivery.id)}
                      >
                        {launchingId === delivery.id ? (
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
                    )}
                    {retryAction?.enabled ? (
                      <Button variant="primary" className="w-full" onClick={() => handleRetry(delivery)}>
                        <RiUploadCloud2Line />
                        {retryAction.label}
                      </Button>
                    ) : null}
                  </div>
                </StudentSurface>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-sm md:block">
            <div className="custom-scrollbar overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
              <thead className="bg-app-bg-subtle">
                <tr className="border-b border-app-border">
                  {["Versión", "Práctica", "Estado", "Resultado y nota", "Fecha", "Acciones"].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-4 text-xs font-semibold uppercase text-app-text-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {filteredDeliveries.map((delivery) => {
                  const { workflow, retryAction, outcome, latestRun } = deriveRow(delivery);

                  return (
                    <tr key={delivery.id} className="align-top transition hover:bg-app-bg-subtle/20">
                      <td className="px-5 py-5">
                        <div className="font-semibold text-app-text">
                          v{delivery.version}
                        </div>
                        <div className="mt-1 text-xs text-app-text-muted">
                          {delivery.remainingDeliveries} intento(s) disponibles
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="font-semibold text-app-text">
                          {delivery.projectTitle ?? "Proyecto"}
                        </div>
                        <div className="mt-1 text-sm text-app-text-muted">
                          {delivery.isLate ? "Entrega tardía" : "Entrega en plazo"}
                        </div>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone={workflow.tone}>{workflow.label}</StatusBadge>
                          {renderOutcomeBadge(outcome)}
                        </div>
                        <p className="mt-3 max-w-md text-sm leading-6 text-app-text-secondary">
                          {workflow.description}
                        </p>
                      </td>
                      <td className="px-5 py-5">
                        {renderGradeBadge(delivery.grade)}
                      </td>
                      <td className="px-5 py-5 text-sm text-app-text-muted">
                        {new Date(delivery.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="secondary" className="text-xs" onClick={() => handleSelectReport(delivery)}>
                            <RiFileTextLine />
                            Ver informe
                          </Button>
                          {!latestRun && (
                            <Button
                              variant="primary"
                              className="text-xs"
                              disabled={launchingId === delivery.id}
                              onClick={() => handleLaunchEvaluation(delivery.id)}
                            >
                              {launchingId === delivery.id ? (
                                <RiLoader4Line className="animate-spin motion-reduce:animate-none" />
                              ) : (
                                <RiRocketLine />
                              )}
                              Evaluar ahora
                            </Button>
                          )}
                          {retryAction?.enabled ? (
                            <Button variant="primary" className="text-xs" onClick={() => handleRetry(delivery)}>
                              <RiUploadCloud2Line />
                              {retryAction.label}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
