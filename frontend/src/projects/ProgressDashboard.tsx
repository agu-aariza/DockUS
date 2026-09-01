/**
 * @fileoverview Vista y gestión de proyectos académicos (ProgressDashboard).
 *
 * @module ProgressDashboard
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RiBarChartFill, RiDownload2Line, RiTeamLine } from "react-icons/ri";
import { builderApi } from "../builder/api/builderApi";
import { deliveriesApi } from "../deliveries/api/deliveriesApi";
import { projectsApi } from "./api/projectsApi";
import { queryKeys } from "../shared/query/queryKeys";
import { useManagementPermissions } from "../shared/session/useManagementPermissions";
import { QualityInsightsDashboard } from "../builder/components/QualityInsightsDashboard";
import {
  buildTeacherDeliveryReviewPath,
  resolveTeacherReviewTarget,
} from "../deliveries/teacherReviewNavigation";
import type { TeacherDeliveryDetailTab } from "../deliveries/teacherReviewNavigation";
import type { BuilderOutcome, BuildRunEntity } from "../features/builder/types";
import type { DeliveryEntity, DeliveryStatus } from "../features/deliveries/types";
import type {
  ProjectEntity,
  ProjectGradebookRow,
} from "../features/projects/types";
import { useSession } from "../shared/session/SessionContext";
import { useToast } from "../shared/toast/ToastContext";
import { getErrorMessage } from "../shared/utils/errors";
import { DeliveryHistoryModal } from "./components/progress/DeliveryHistoryModal";
import { DistributionCharts } from "./components/progress/DistributionCharts";
import {
  GradebookFilters,
  type GroupOption,
} from "./components/progress/GradebookFilters";
import { GradebookTable } from "./components/progress/GradebookTable";
import { ParticipationProgress } from "./components/progress/ParticipationProgress";
import {
  PreviewOrGradingModal,
  type PreviewFile,
} from "./components/progress/PreviewOrGradingModal";
import { ProgressStatsPanel } from "./components/progress/ProgressStatsPanel";
import { ProjectSelector } from "./components/progress/ProjectSelector";

interface ProgressDashboardProps {
  projectOptions?: ProjectEntity[];
  selectedProjectId?: string;
  embedded?: boolean;
}

function toGroupOptions(rows: ProjectGradebookRow[]): GroupOption[] {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    row.groupIds.forEach((groupId, index) => {
      if (!map.has(groupId)) {
        map.set(groupId, row.groupLabels[index] ?? groupId);
      }
    });
  });

  return [...map.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function ProgressDashboard({
  projectOptions = [],
  selectedProjectId = "",
  embedded = false,
}: ProgressDashboardProps): JSX.Element {
  const { activeSession: session } = useSession();
  const navigate = useNavigate();
  const { pushToast } = useToast();
  const { canWrite } = useManagementPermissions(session);
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState(selectedProjectId);
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"gradebook" | "insights">("gradebook");

  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "ALL">("ALL");
  const [outcomeFilter, setOutcomeFilter] = useState<BuilderOutcome | "ALL">("ALL");
  const [lateOnly, setLateOnly] = useState(false);
  const [groupFilter, setGroupFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<DeliveryEntity | null>(null);
  const [selectedReportRun, setSelectedReportRun] = useState<BuildRunEntity | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyDeliveries, setHistoryDeliveries] = useState<DeliveryEntity[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState("");

  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
      setGroupFilter("ALL");
    }
  }, [selectedProjectId]);

  // En modo embedded, la query se dispara sola al cambiar proyecto/filtro de
  // grupo (reactiva); en modo standalone, ProjectSelector exige un clic
  // explícito en "Cargar" (ver onLoad más abajo) — mismo patrón de "envío
  // explícito" que Storage/Users, solo que aquí basta con actualizar la key
  // (el useQuery de abajo reacciona solo, sin necesitar fetchQuery) porque
  // nadie necesita el valor resuelto de forma síncrona en el propio handler.
  const [submittedQuery, setSubmittedQuery] = useState<{ projectId: string; groupId?: string } | null>(null);

  useEffect(() => {
    if (!embedded || !selectedProjectId || !session) return;
    const groupId = groupFilter === "ALL" ? undefined : groupFilter;
    setSubmittedQuery({ projectId: selectedProjectId.trim(), groupId });
  }, [embedded, groupFilter, selectedProjectId, session]);

  const summaryQuery = useQuery({
    queryKey: queryKeys.projects.progressSummary(submittedQuery?.projectId ?? "", submittedQuery?.groupId),
    queryFn: () => projectsApi.progressSummary(submittedQuery!.projectId, { groupId: submittedQuery!.groupId }),
    enabled: submittedQuery !== null,
  });
  const gradebookQuery = useQuery({
    queryKey: queryKeys.projects.gradebook(submittedQuery?.projectId ?? "", submittedQuery?.groupId),
    queryFn: () => projectsApi.gradebook(submittedQuery!.projectId, { groupId: submittedQuery!.groupId }),
    enabled: submittedQuery !== null,
  });
  const summary = summaryQuery.data ?? null;
  const gradebook = gradebookQuery.data ?? [];
  const loading = submittedQuery !== null && (summaryQuery.isFetching || gradebookQuery.isFetching);

  useEffect(() => {
    const rows = gradebookQuery.data;
    if (!rows) return;
    if (submittedQuery?.groupId === undefined || availableGroups.length === 0) {
      setAvailableGroups(toGroupOptions(rows));
    }
  }, [gradebookQuery.data]);

  useEffect(() => {
    const error = summaryQuery.error ?? gradebookQuery.error;
    if (error) {
      pushToast({ title: "Seguimiento", description: getErrorMessage(error), tone: "error" });
    }
  }, [summaryQuery.error, gradebookQuery.error, pushToast]);

  const refetchDashboard = () => Promise.all([summaryQuery.refetch(), gradebookQuery.refetch()]);

  // Botón "Cargar" del selector standalone: un clic explícito debe golpear
  // red siempre, incluso repitiendo el mismo proyecto/grupo dentro de la
  // ventana de staleTime — igual que el patrón fetchQuery+staleTime:0 usado
  // en Storage/Users para "Buscar". setSubmittedQuery por sí solo no basta
  // aquí: si la key no cambia, useQuery serviría caché sin ir a red. El error,
  // si lo hay, ya lo muestra el efecto de arriba (fetchQuery escribe en la
  // misma caché que observan summaryQuery/gradebookQuery) — no duplicar aviso.
  const handleLoadClick = async () => {
    const targetProjectId = projectId.trim();
    if (!targetProjectId || !session) return;
    const groupId = groupFilter === "ALL" ? undefined : groupFilter;
    setSubmittedQuery({ projectId: targetProjectId, groupId });
    await Promise.allSettled([
      queryClient.fetchQuery({
        queryKey: queryKeys.projects.progressSummary(targetProjectId, groupId),
        queryFn: () => projectsApi.progressSummary(targetProjectId, { groupId }),
        staleTime: 0,
      }),
      queryClient.fetchQuery({
        queryKey: queryKeys.projects.gradebook(targetProjectId, groupId),
        queryFn: () => projectsApi.gradebook(targetProjectId, { groupId }),
        staleTime: 0,
      }),
    ]);
  };

  const handlePreview = async (deliveryId: string) => {
    setIsLoadingPreview(true);
    setIsPreviewModalOpen(true);
    setSelectedDelivery(null);
    setSelectedReportRun(null);
    try {
      const files = await deliveriesApi.preview(deliveryId);
      setPreviewFiles(files);

      const delivery = await deliveriesApi.detail(deliveryId);
      setSelectedDelivery(delivery);

      try {
        const runs = await builderApi.listByDelivery({
          deliveryId,
          limit: 1,
          sortOrder: "DESC",
        });
        const latestRun = runs.data[0] ?? null;
        if (latestRun) {
          const fullRun = await builderApi.detail(latestRun.id);
          setSelectedReportRun(fullRun);
        }
      } catch (err) {
        console.error("Error loading run report:", err);
      }
    } catch (error) {
      pushToast({
        title: "Error previsualizando",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsPreviewModalOpen(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleViewHistory = async (assignmentId: string, studentName: string) => {
    setIsLoadingHistory(true);
    setIsHistoryModalOpen(true);
    setSelectedStudentName(studentName);
    try {
      const result = await deliveriesApi.list({ assignmentId });
      setHistoryDeliveries(result.data);
    } catch (error) {
      pushToast({
        title: "Error cargando historial",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsHistoryModalOpen(false);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openTeacherReview = (
    assignmentId: string,
    deliveryId: string,
    tab: TeacherDeliveryDetailTab,
  ) => {
    if (!projectId.trim()) {
      return;
    }

    navigate(
      buildTeacherDeliveryReviewPath({
        projectId: projectId.trim(),
        assignmentId,
        deliveryId,
        tab: tab === "grading" ? "grading" : "report",
      }),
    );
  };

  const handleSubmitGrading = async (grade: string, graderNotes: string) => {
    if (!selectedDelivery) {
      return;
    }

    try {
      await deliveriesApi.updateGrading(selectedDelivery.id, {
        grade: grade.trim() ? Number(grade) : null,
        graderNotes,
      });
      pushToast({
        title: "Calificación guardada",
        description: "La nota oficial ha sido consolidada.",
        tone: "success",
      });
      setIsPreviewModalOpen(false);
      if (projectId.trim()) {
        // La key de la query no cambia (mismo proyecto/grupo): hace falta un
        // refetch explícito, no basta con re-enviar la misma key.
        await refetchDashboard();
      }
    } catch (error) {
      pushToast({
        title: "Error al calificar",
        description: getErrorMessage(error),
        tone: "error",
      });
    }
  };

  const handleGroupChange = async (nextGroupId: string) => {
    setGroupFilter(nextGroupId);
    if (projectId.trim() && session) {
      setSubmittedQuery({ projectId: projectId.trim(), groupId: nextGroupId === "ALL" ? undefined : nextGroupId });
    }
  };

  const exportCsv = async () => {
    if (!projectId.trim()) return;
    setExporting(true);
    try {
      const blob = await projectsApi.exportGradebook(projectId.trim(), {
        deliveryStatus: statusFilter === "ALL" ? undefined : statusFilter,
        builderOutcome: outcomeFilter === "ALL" ? undefined : outcomeFilter,
        lateOnly,
        groupId: groupFilter === "ALL" ? undefined : groupFilter,
      });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `gradebook-${projectId.slice(0, 8)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
      pushToast({
        title: "Gradebook exportado",
        description: "El CSV del seguimiento ya está listo.",
        tone: "success",
      });
    } catch (error) {
      pushToast({
        title: "No se pudo exportar",
        description: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return gradebook.filter((row) => {
      if (statusFilter !== "ALL" && row.latestStatus !== statusFilter) {
        return false;
      }
      if (outcomeFilter !== "ALL" && row.latestBuilderOutcome !== outcomeFilter) {
        return false;
      }
      if (lateOnly && !row.isLate) {
        return false;
      }
      if (normalizedSearch) {
        const matches = [row.studentName, row.studentEmail]
          .filter(Boolean)
          .some((val) => val.toLowerCase().includes(normalizedSearch));
        if (!matches) return false;
      }
      return true;
    });
  }, [deferredSearch, gradebook, lateOnly, outcomeFilter, statusFilter]);
  const deferredRows = useDeferredValue(filteredRows);

  const total = summary?.totalAssignments ?? 0;
  const delivered = summary?.deliveredAtLeastOnce ?? 0;
  const rate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  return (
    <div className="space-y-8">
      {!embedded ? (
        <ProjectSelector
          projectOptions={projectOptions}
          projectId={projectId}
          loading={loading}
          onProjectChange={(nextProjectId) => {
            setProjectId(nextProjectId);
            setGroupFilter("ALL");
          }}
          onLoad={() => void handleLoadClick()}
        />
      ) : null}

      {summary ? (
        <div className="space-y-8">
          <div className="space-y-5">
            <p className="ui-label">Estado general</p>
            <ProgressStatsPanel summary={summary} />
            <ParticipationProgress rate={rate} delivered={delivered} total={total} />
            <DistributionCharts summary={summary} total={total} />
          </div>

          <div className="flex items-center gap-1 border-b border-app-border">
            <button
              onClick={() => setActiveTab("gradebook")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                activeTab === "gradebook"
                  ? "border-b-2 border-primary bg-primary-subtle text-primary"
                  : "text-app-text-muted hover:text-app-text"
              }`}
            >
              <RiTeamLine />
              Gradebook de Alumnos
            </button>
            <button
              onClick={() => setActiveTab("insights")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                activeTab === "insights"
                  ? "border-b-2 border-accent bg-accent-subtle text-accent"
                  : "text-app-text-muted hover:text-app-text"
              }`}
            >
              <RiBarChartFill />
              Insights de Calidad
            </button>
          </div>

          {activeTab === "insights" ? (
            <QualityInsightsDashboard
              projectId={projectId}
              students={
                summary.perStudent.map((student) => ({
                  studentId: student.studentId,
                  studentName: student.studentName,
                  studentEmail: student.studentEmail,
                })) ?? []
              }
              reviewTargets={Object.fromEntries(
                gradebook
                  .filter((row) => row.latestDeliveryId)
                  .map((row) => [
                    row.studentId,
                    {
                      assignmentId: row.assignmentId,
                      deliveryId: row.latestDeliveryId!,
                    },
                  ]),
              )}
              onOpenStudentReview={(studentId, tab = "report") => {
                const target = resolveTeacherReviewTarget(gradebook, studentId);
                if (!target) {
                  return;
                }

                openTeacherReview(target.assignmentId, target.deliveryId, tab);
              }}
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-app-border bg-app-surface">
              <div className="flex flex-col gap-4 border-b border-app-border-subtle p-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-app-text">
                    Gradebook del proyecto
                  </h3>
                  <p className="mt-2 text-sm text-app-text-secondary">
                    {deferredRows.length} alumno(s) visibles tras aplicar filtros.
                  </p>
                </div>
                <button
                  className="btn-secondary"
                  onClick={() => void exportCsv()}
                  disabled={exporting}
                >
                  <RiDownload2Line />
                  {exporting ? "Exportando..." : "Exportar CSV"}
                </button>
              </div>

              <GradebookFilters
                search={search}
                onSearchChange={setSearch}
                availableGroups={availableGroups}
                groupFilter={groupFilter}
                onGroupChange={(nextGroupId) => void handleGroupChange(nextGroupId)}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                outcomeFilter={outcomeFilter}
                onOutcomeChange={setOutcomeFilter}
                lateOnly={lateOnly}
                onLateOnlyChange={setLateOnly}
              />

              <GradebookTable
                rows={deferredRows}
                loading={loading}
                onPreview={(deliveryId) => void handlePreview(deliveryId)}
                onOpenReview={openTeacherReview}
                onViewHistory={(assignmentId, studentName) =>
                  void handleViewHistory(assignmentId, studentName)
                }
              />
            </div>
          )}
        </div>
      ) : (
        !embedded && (
          <div className="rounded-lg border border-dashed border-app-border bg-app-bg-subtle px-6 py-10 text-center text-sm text-app-text-secondary">
            Selecciona un proyecto para cargar métricas, distribución y gradebook.
          </div>
        )
      )}

      <DeliveryHistoryModal
        isOpen={isHistoryModalOpen}
        studentName={selectedStudentName}
        deliveries={historyDeliveries}
        loading={isLoadingHistory}
        onClose={() => setIsHistoryModalOpen(false)}
        onPreview={(deliveryId) => void handlePreview(deliveryId)}
      />

      <PreviewOrGradingModal
        isOpen={isPreviewModalOpen}
        canWrite={canWrite}
        delivery={selectedDelivery}
        reportRun={selectedReportRun}
        files={previewFiles}
        isLoadingFiles={isLoadingPreview}
        onClose={() => setIsPreviewModalOpen(false)}
        onSubmitGrading={handleSubmitGrading}
      />
    </div>
  );
}
