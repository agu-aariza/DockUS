import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { RiLayoutGridFill, RiFolderOpenFill, RiInboxArchiveFill, RiUploadCloud2Fill, RiFileTextFill, RiNotification3Fill } from "react-icons/ri";
import type { SessionRecord } from "../shared/types";
import { useToast } from "../shared/toast/ToastContext";
import { StudentHomeSection } from "./StudentHomeSection";
import { StudentAssignmentsSection } from "./StudentAssignmentsSection";
import { StudentDeliveriesSection } from "./StudentDeliveriesSection";
import { StudentSubmissionFlow } from "./StudentSubmissionFlow";
import { StudentReportsSection } from "./StudentReportsSection";
import { EvaluationNotificationBanner } from "./EvaluationNotificationBanner";
import { StudentDeadlineBanner } from "./StudentDeadlineBanner";
import { useStudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import { useEvaluationNotifications } from "./hooks/useEvaluationNotifications";

interface StudentWorkspacePanelProps {
  session: SessionRecord | null;
}

export type StudentTab = "resumen" | "proyectos" | "entregas" | "subir" | "informes";

export function StudentWorkspacePanel({ session }: StudentWorkspacePanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as StudentTab) || "resumen";
  
  const workspaceData = useStudentWorkspaceData();
  const { notifications, dismissNotification, dismissAll, hasUnread } = useEvaluationNotifications();
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
          notification.outcome === "SUCCESS"
            ? "Evaluación completada"
            : notification.outcome === "FAILED"
              ? "Evaluación finalizada con incidencias"
              : "Evaluación cancelada",
        description: `${notification.projectTitle} · entrega v${notification.deliveryVersion}`,
        tone:
          notification.outcome === "SUCCESS"
            ? "success"
            : notification.outcome === "FAILED"
              ? "error"
              : "warning",
        durationMs: 7000,
      });
    });
  }, [notifications, pushToast]);

  const handleTabChange = (tab: StudentTab) => {
    setSearchParams({ tab });
  };

  const handleViewReport = (_deliveryId: string) => {
    // Refresh data and navigate to reports
    void workspaceData.refresh();
    handleTabChange("informes");
  };

  const navigation = [
    { id: "resumen", label: "Resumen", icon: <RiLayoutGridFill /> },
    { id: "proyectos", label: "Mis proyectos", icon: <RiFolderOpenFill /> },
    { id: "entregas", label: "Mis entregas", icon: <RiInboxArchiveFill /> },
    { id: "subir", label: "Subir versión", icon: <RiUploadCloud2Fill /> },
    { id: "informes", label: "Mis informes", icon: <RiFileTextFill />, badge: hasUnread },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Mi Espacio
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Bienvenido al portal del alumno. Desde aquí puedes consultar tus asignaciones, 
              subir nuevas versiones de tus prácticas y revisar los informes de evaluación.
            </p>
          </div>
          {hasUnread && (
            <div className="flex items-center gap-2 rounded-full bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 animate-in fade-in">
              <RiNotification3Fill className="text-indigo-500 animate-pulse" />
              {notifications.length} {notifications.length === 1 ? "resultado nuevo" : "resultados nuevos"}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {navigation.map((tab) => (
          <button
            key={tab.id}
            className={`px-6 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all relative ${
              activeTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => handleTabChange(tab.id as StudentTab)}
          >
            {tab.icon}
            {tab.label}
            {"badge" in tab && tab.badge && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Notification banner — shown on all tabs */}
      <EvaluationNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
        onDismissAll={dismissAll}
        onViewReport={handleViewReport}
      />

      <StudentDeadlineBanner
        assignments={workspaceData.assignments}
        onNavigate={handleTabChange}
      />

      <main>
        {activeTab === "resumen" && <StudentHomeSection session={session} data={workspaceData} onNavigate={handleTabChange} />}
        {activeTab === "proyectos" && <StudentAssignmentsSection session={session} data={workspaceData} onNavigate={handleTabChange} />}
        {activeTab === "entregas" && <StudentDeliveriesSection session={session} data={workspaceData} onNavigate={handleTabChange} />}
        {activeTab === "subir" && <StudentSubmissionFlow session={session} data={workspaceData} onNavigate={handleTabChange} />}
        {activeTab === "informes" && <StudentReportsSection session={session} data={workspaceData} />}
      </main>
    </div>
  );
}
