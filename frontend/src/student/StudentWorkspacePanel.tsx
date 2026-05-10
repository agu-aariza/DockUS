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

import type { SessionRecord } from "../shared/types";
import { MetricCard } from "../shared/components/MetricCard";
import { Button } from "../shared/components/ui/Button";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Tabs } from "../shared/components/ui/Tabs";
import { useToast } from "../shared/toast/ToastContext";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { StudentSurface, StudentKeyValueList, StudentSurfaceHeader } from "./components/StudentWorkspaceSurface";
import { StudentHomeSection } from "./StudentHomeSection";
import { StudentAssignmentsSection } from "./StudentAssignmentsSection";
import { StudentDeliveriesSection } from "./StudentDeliveriesSection";
import { StudentSubmissionFlow } from "./StudentSubmissionFlow";
import { StudentReportsSection } from "./StudentReportsSection";
import { EvaluationNotificationBanner } from "./EvaluationNotificationBanner";
import { StudentDeadlineBanner } from "./StudentDeadlineBanner";
import { useStudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { useEvaluationNotifications } from "./hooks/useEvaluationNotifications";
import { deriveStudentWorkspaceInsights } from "./studentWorkspaceInsights";
import { pickPrimaryAssignment } from "./deadlineUtils";
import {
  deriveStudentWorkflowState,
  describeStudentWorkflowState,
} from "./studentWorkflowState";

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

  const workspaceData = useStudentWorkspaceData();
  const { notifications, dismissNotification, dismissAll, hasUnread } =
    useEvaluationNotifications();
  const { pushToast } = useToast();
  const seenNotificationIdsRef = useRef(new Set<string>());

  useEffect(() => {
    notifications.forEach((notification) => {
      if (seenNotificationIdsRef.current.has(notification.id)) {
        return;
      }

      seenNotificationIdsRef.current.add(notification.id);
      pushToast({
        title:
          notification.kind === "grade_published"
            ? "Nota oficial publicada"
            : "Informe técnico disponible",
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
  }, [notifications, pushToast]);

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
    { id: "subir", label: "Subir versión", icon: <RiUploadCloud2Fill /> },
    {
      id: "informes",
      label: "Mis informes",
      icon: <RiFileTextFill />,
      badge: hasUnread,
    },
  ];

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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Mi espacio"
        subtitle="Un workspace académico para seguir tu práctica activa, revisar informes y preparar la siguiente versión sin perder el contexto."
        icon={<RiGraduationCapLine />}
        badge={activeAssignment ? "Workspace activo" : "Pendiente de asignación"}
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
                  Subir versión
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

      <div className="grid gap-4 xl:grid-cols-[1.15fr,1.85fr]">
        <StudentSurface tone="accent" className="h-full">
          <StudentSurfaceHeader
            eyebrow="Contexto actual"
            title={activeAssignment?.projectTitle ?? "Aún no tienes una práctica activa"}
            description={
              activeAssignment
                ? "Este es tu foco principal ahora mismo. Desde aquí puedes entender el estado real de la práctica, cuánto margen te queda y a qué superficie conviene saltar."
                : "Cuando tengas una asignación activa, aquí verás la práctica seleccionada, la última entrega y la siguiente acción prioritaria."
            }
            badge={
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${activeWorkflow.badgeClassName}`}
              >
                {activeWorkflow.label}
              </span>
            }
          />
          <StudentKeyValueList
            className="mt-6"
            items={[
              {
                label: "Proyecto",
                value: formatContextValue(activeAssignment?.projectTitle ?? null),
              },
              {
                label: "Asignación",
                value: formatContextValue(activeAssignment?.studentName ?? null),
              },
              {
                label: "Última entrega",
                value: activeDelivery ? `v${activeDelivery.version}` : "Sin entregas",
              },
              {
                label: "Siguiente foco",
                value: hasUnread
                  ? "Revisar resultados recientes"
                  : workspaceData.assignments.length > 0
                    ? "Preparar próxima versión"
                    : "Esperar asignaciones",
              },
            ]}
          />
        </StudentSurface>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Asignaciones activas"
            value={insights.activeAssignments}
            helper={`${insights.revokedAssignments} revocadas`}
            icon={<RiBookOpenLine />}
            variant="default"
          />
          <MetricCard
            label="Entregas"
            value={insights.totalDeliveries}
            helper={`${insights.pendingEvaluations} en seguimiento`}
            icon={<RiInboxArchiveFill />}
            variant="info"
          />
          <MetricCard
            label="Informes listos"
            value={insights.reportsReady}
            helper={`${insights.blockedReports} con bloqueos`}
            icon={<RiFileTextFill />}
            variant={insights.blockedReports > 0 ? "warning" : "success"}
          />
          <MetricCard
            label="Notas oficiales"
            value={insights.officialGrades}
            helper={
              insights.latestGrade !== null
                ? `Última nota ${insights.latestGrade.toFixed(2)}`
                : "Todavía sin nota"
            }
            icon={<RiAwardLine />}
            variant={insights.latestGrade !== null ? "success" : "default"}
          />
        </div>
      </div>

      <EvaluationNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
        onDismissAll={dismissAll}
        onViewReport={handleViewReport}
      />

      <div className="overflow-hidden rounded-[2rem] border border-academic-surface-variant bg-white shadow-sm">
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

      <StudentDeadlineBanner
        assignments={workspaceData.assignments}
        onNavigate={handleTabChange}
      />

      <main className="space-y-8">
        {activeTab === "resumen" && (
          <StudentHomeSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        )}
        {activeTab === "proyectos" && (
          <StudentAssignmentsSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        )}
        {activeTab === "entregas" && (
          <StudentDeliveriesSection
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        )}
        {activeTab === "subir" && (
          <StudentSubmissionFlow
            session={session}
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        )}
        {activeTab === "informes" && (
          <StudentReportsSection session={session} data={workspaceData} />
        )}
      </main>
    </div>
  );
}
