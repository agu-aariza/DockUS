import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RiBarChartFill, RiDownload2Line, RiTeamLine } from "react-icons/ri";
import { builderApi, deliveriesApi, projectsApi } from "../shared/api/services";
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
  ProjectProgressSummary,
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

  const [projectId, setProjectId] = useState(selectedProjectId);
  const [summary, setSummary] = useState<ProjectProgressSummary | null>(null);
  const [gradebook, setGradebook] = useState<ProjectGradebookRow[]>([]);
  const [availableGroups, setAvailableGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
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

  const fetchDashboard = async (
    targetProjectId: string,
    targetGroupId = groupFilter,
  ) => {
    if (!targetProjectId.trim() || !session) {
      return;
    }

    setLoading(true);
    try {
      const groupId = targetGroupId === "ALL" ? undefined : targetGroupId;
      const [summaryData, gradebookData] = await Promise.all([
        projectsApi.progressSummary(targetProjectId.trim(), { groupId }),
        projectsApi.gradebook(targetProjectId.trim(), { groupId }),
      ]);
      setSummary(summaryData);
      setGradebook(gradebookData);
      if (groupId === undefined || availableGroups.length === 0) {
        setAvailableGroups(toGroupOptions(gradebookData));
      }
    } catch (error) {
      pushToast({
        title: "Seguimiento",
        description: getErrorMessage(error),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!embedded || !selectedProjectId || !session) {
      return;
    }

    void fetchDashboard(selectedProjectId.trim(), groupFilter);
  }, [embedded, groupFilter, selectedProjectId, session]);

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
        await fetchDashboard(projectId.trim(), groupFilter);
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
      await fetchDashboard(projectId.trim(), nextGroupId);
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
          onLoad={() => void fetchDashboard(projectId.trim(), groupFilter)}
        />
      ) : null}

      {summary ? (
        <div className="space-y-8">
          <ProgressStatsPanel summary={summary} />
          <ParticipationProgress rate={rate} />
          <DistributionCharts summary={summary} total={total} />

          <div className="flex items-center gap-1 border-b border-slate-200">
            <button
              onClick={() => setActiveTab("gradebook")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none ${
                activeTab === "gradebook"
                  ? "border-b-2 border-primary bg-primary-subtle text-primary"
                  : "text-slate-500 hover:text-slate-900"
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
                  : "text-slate-500 hover:text-slate-900"
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
            <div className="overflow-hidden rounded-lg border border-app-border bg-white">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-900">
                    Gradebook del proyecto
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
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
          <div className="rounded-lg border border-dashed border-app-border bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
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
