import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

import { useToast } from "../shared/toast/ToastContext";
import type { SessionRecord } from "../shared/types";
import { EvaluationNotificationBanner } from "./EvaluationNotificationBanner";
import { StudentAssignmentsSection } from "./StudentAssignmentsSection";
import { StudentDeliveriesSection } from "./StudentDeliveriesSection";
import { StudentHomeSection } from "./StudentHomeSection";
import { StudentReportsSection } from "./StudentReportsSection";
import { StudentSubmissionFlow } from "./StudentSubmissionFlow";
import { useBuildRunStream } from "./hooks/useBuildRunStream";
import { useEvaluationNotifications } from "./hooks/useEvaluationNotifications";
import { useStudentWorkspaceData } from "./hooks/useStudentWorkspaceData";

interface StudentWorkspacePanelProps {
  session: SessionRecord | null;
}

type StudentTab =
  | "summary"
  | "proyectos"
  | "entregas"
  | "subir"
  | "informes";

export function StudentWorkspacePanel({
  session,
}: StudentWorkspacePanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as StudentTab) || "summary";
  const mainHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const seenNotificationIdsRef = useRef(new Set<string>());

  const workspaceData = useStudentWorkspaceData();
  const { pushToast } = useToast();

  const activeMonitoringRun =
    workspaceData.deliveries
      .map((delivery) => workspaceData.latestRunByDeliveryId[delivery.id] ?? null)
      .find((run) => Boolean(run && !run.isTerminal)) ?? null;
  const runMonitor = useBuildRunStream(activeMonitoringRun, session);
  const { notifications, dismissNotification, dismissAll } =
    useEvaluationNotifications({
      pollIntervalMs: runMonitor.streamState === "streaming" ? 60_000 : 15_000,
    });

  useEffect(() => {
    let hasNewNotifications = false;
    notifications.forEach((notification) => {
      if (seenNotificationIdsRef.current.has(notification.id)) return;
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
    if (hasNewNotifications) {
      void workspaceData.refresh();
    }
  }, [notifications, pushToast, workspaceData.refresh]);

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
      const currentTab = (searchParams.get("tab") as StudentTab) || "summary";
      if (currentTab !== "subir" && currentTab !== "informes") {
        handleTabChange("informes");
      }
    }
  }, [runMonitor.progress.stage, workspaceData.refresh, searchParams]);

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

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8 flex flex-col">
      <a
        href="#student-workspace-main"
        className="sr-only rounded-full border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[150]"
      >
        Saltar al contenido principal
      </a>

      <EvaluationNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
        onDismissAll={dismissAll}
        onViewReport={handleViewReport}
      />

      <main
        id="student-workspace-main"
        className="flex-1 space-y-6 p-5 lg:p-8"
      >
        <h2 ref={mainHeadingRef} tabIndex={-1} className="sr-only">
          Contenido principal del espacio del alumno: {activeTab}
        </h2>

        {activeTab === "summary" ? (
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
