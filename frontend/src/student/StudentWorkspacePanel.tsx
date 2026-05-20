import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  RiAwardLine,
  RiBookOpenLine,
  RiFileTextFill,
  RiFolderOpenFill,
  RiGraduationCapLine,
  RiInboxArchiveFill,
  RiNotification3Fill,
  RiPulseLine,
  RiUploadCloud2Fill,
} from "react-icons/ri";

import { MetricCard } from "../shared/components/MetricCard";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Tabs } from "../shared/components/ui/Tabs";
import { Button } from "../shared/components/ui/Button";
import { useToast } from "../shared/toast/ToastContext";
import type { SessionRecord } from "../shared/types";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { EvaluationNotificationBanner } from "./EvaluationNotificationBanner";
import { StudentAssignmentsSection } from "./StudentAssignmentsSection";

import { StudentDeliveriesSection } from "./StudentDeliveriesSection";
import { StudentHomeSection } from "./StudentHomeSection";
import { StudentReportsSection } from "./StudentReportsSection";
import { StudentSubmissionFlow } from "./StudentSubmissionFlow";
import {
  StudentKeyValueList,
  StudentSurface,
  StudentSurfaceHeader,
} from "./components/StudentWorkspaceSurface";
import { pickPrimaryAssignment } from "./deadlineUtils";
import { useBuildRunStream } from "./hooks/useBuildRunStream";
import { useEvaluationNotifications } from "./hooks/useEvaluationNotifications";
import { useStudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";
import { deriveStudentWorkspaceInsights } from "./studentWorkspaceInsights";

interface StudentWorkspacePanelProps {
  session: SessionRecord | null;
}

export type StudentTab =
  | "resumen"
  | "proyectos"
  | "entregas"
  | "subir"
  | "informes";

function formatContextValue(value?: string | null): string {
  return value?.trim() ? value : "Sin seleccionar";
}

export function StudentWorkspacePanel({
  session,
}: StudentWorkspacePanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as StudentTab) || "resumen";
  const { selection } = useWorkspace();
  const mainHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const seenNotificationIdsRef = useRef(new Set<string>());

  const workspaceData = useStudentWorkspaceData();
  const { pushToast } = useToast();

  const activeAssignment =
    pickPrimaryAssignment(
      workspaceData.assignments,
      selection.assignmentId,
      selection.projectId,
    ) ?? null;
  const activeDelivery =
    workspaceData.deliveries.find(
      (delivery) => delivery.id === selection.deliveryId,
    ) ??
    (activeAssignment
      ? workspaceData.deliveries.find(
          (delivery) => delivery.assignmentId === activeAssignment.id,
        )
      : null) ??
    workspaceData.latestDelivery ??
    null;
  const activeRun = activeDelivery
    ? workspaceData.latestRunByDeliveryId[activeDelivery.id] ?? null
    : null;
  const activeWorkflow = describeStudentWorkflowState(
    deriveStudentWorkflowState({
      assignment: activeAssignment,
      delivery: activeDelivery,
      latestRun: activeRun,
      now: Date.now(),
    }),
    {
      isLate: activeDelivery?.isLate,
      projectTitle:
        activeAssignment?.projectTitle ?? activeDelivery?.projectTitle ?? null,
    },
  );

  const insights = deriveStudentWorkspaceInsights(
    workspaceData.assignments,
    workspaceData.deliveries,
    workspaceData.latestRunByDeliveryId,
  );
  const activeMonitoringRun =
    workspaceData.deliveries
      .map((delivery) => workspaceData.latestRunByDeliveryId[delivery.id] ?? null)
      .find((run) => Boolean(run && !run.isTerminal)) ?? null;
  const runMonitor = useBuildRunStream(activeMonitoringRun, session);
  const { notifications, dismissNotification, dismissAll, hasUnread } =
    useEvaluationNotifications({
      pollIntervalMs: runMonitor.streamState === "streaming" ? 60_000 : 15_000,
    });

  useEffect(() => {
    let hasNewNotifications = false;
    notifications.forEach((notification) => {
      if (seenNotificationIdsRef.current.has(notification.id)) {
        return;
      }

      hasNewNotifications = true;
      seenNotificationIdsRef.current.add(notification.id);
      pushToast({
        title:
          notification.kind === "grade_published"
            ? "Nota oficial publicada"
            : "Informe tecnico disponible",
        description:
          notification.kind === "grade_published" && notification.grade !== null
            ? `${notification.projectTitle} · entrega v${notification.deliveryVersion} · nota ${notification.grade.toFixed(2)}`
            : `${notification.projectTitle} · entrega v${notification.deliveryVersion}`,
        tone:
          notification.kind === "grade_published"
            ? "success"
            : notification.outcome === "FAILED"
              ? "error"
              : notification.outcome === "CANCELLED"
                ? "warning"
                : "success",
        durationMs: 7000,
      });
    });

    // Auto-refresh workspace data when a new evaluation completes,
    // so the student sees the latest report without manual navigation.
    if (hasNewNotifications) {
      void workspaceData.refresh();
    }
  }, [notifications, pushToast, workspaceData.refresh]);

  // Auto-refresh when the monitored run reaches a terminal stage,
  // so the report updates immediately without waiting for the next poll.
  const prevStageRef = useRef(runMonitor.progress.stage);
  useEffect(() => {
    const prev = prevStageRef.current;
    const curr = runMonitor.progress.stage;
    prevStageRef.current = curr;

    if (
      prev !== curr &&
      (curr === "completed" || curr === "failed") &&
      prev !== "completed" &&
      prev !== "failed"
    ) {
      void workspaceData.refresh();
    }
  }, [runMonitor.progress.stage, workspaceData.refresh]);

  useEffect(() => {
    mainHeadingRef.current?.focus();
  }, [activeTab]);

  const handleTabChange = (tab: StudentTab) => {
    setSearchParams({ tab });
  };

  const handleViewReport = (_deliveryId: string) => {
    void workspaceData.refresh();
    handleTabChange("informes");
  };

  const navigation = [
    { id: "resumen", label: "Resumen", icon: <RiPulseLine /> },
    { id: "proyectos", label: "Mis proyectos", icon: <RiFolderOpenFill /> },
    { id: "entregas", label: "Mis entregas", icon: <RiInboxArchiveFill /> },
    { id: "subir", label: "Subir version", icon: <RiUploadCloud2Fill /> },
    {
      id: "informes",
      label: "Mis informes",
      icon: <RiFileTextFill />,
      badge: hasUnread,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <a
        href="#student-workspace-main"
        className="sr-only rounded-full border border-brand-blue bg-white px-4 py-2 text-sm font-semibold text-brand-blue focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[150]"
      >
        Saltar al contenido principal
      </a>

      <PageHeader
        title="Mi espacio"
        subtitle="Un workspace academico para seguir tu practica activa, revisar informes y preparar la siguiente version sin perder el contexto."
        icon={<RiGraduationCapLine />}
        badge={activeAssignment ? "Workspace activo" : "Pendiente de asignacion"}
        actions={
          <>
            {hasUnread ? (
              <Button variant="primary" onClick={() => handleTabChange("informes")}>
                <RiNotification3Fill />
                {notifications.length} resultado{notifications.length === 1 ? "" : "s"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              onClick={() =>
                handleTabChange(
                  workspaceData.assignments.length > 0 ? "subir" : "proyectos",
                )
              }
            >
              {workspaceData.assignments.length > 0 ? (
                <>
                  <RiUploadCloud2Fill />
                  Subir version
                </>
              ) : (
                <>
                  <RiFolderOpenFill />
                  Ver proyectos
                </>
              )}
            </Button>
          </>
        }
      />


      <EvaluationNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
        onDismissAll={dismissAll}
        onViewReport={handleViewReport}
      />

      <div className="overflow-hidden rounded-[2rem] border border-academic-surface-variant bg-white shadow-academic">
        <div className="overflow-x-auto">
          <Tabs
            tabs={navigation.map((tab) => ({
              id: tab.id,
              label: tab.label,
              icon: tab.icon,
              badge: tab.badge,
            }))}
            activeTab={activeTab}
            onTabChange={(id) => handleTabChange(id as StudentTab)}
            className="min-w-max px-4"
          />
        </div>
      </div>



      <main id="student-workspace-main" className="space-y-8">
        <h2 ref={mainHeadingRef} tabIndex={-1} className="sr-only">
          Contenido principal del espacio del alumno: {activeTab}
        </h2>

        {activeTab === "resumen" ? (
          <StudentHomeSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "proyectos" ? (
          <StudentAssignmentsSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "entregas" ? (
          <StudentDeliveriesSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "subir" ? (
          <StudentSubmissionFlow
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "informes" ? (
          <StudentReportsSection session={session} data={workspaceData} />
        ) : null}
      </main>
    </div>
  );
}
