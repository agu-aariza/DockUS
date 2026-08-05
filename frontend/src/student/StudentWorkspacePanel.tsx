/**
 * @fileoverview Panel principal de trabajo para el rol de Estudiante (`STUDENT`).
 *
 * @description
 * Orquesta la experiencia del alumno dividida en pestañas navegables por URL (`?tab=`):
 * - `summary`: Vista de inicio con métricas de entregas y tareas pendientes (`StudentHomeSection`).
 * - `assignments`: Lista de tareas académicas publicadas (`StudentAssignmentsSection`).
 * - `deliveries`: Historial de ZIPs entregados e intentos (`StudentDeliveriesSection`).
 * - `record`: Expediente académico del alumno (`StudentRecordSection`).
 * - `reports`: Informe pedagógico estructurado y detallado de las evaluaciones (`StudentReportsSection`).
 * - Contiene el flujo modal de subida de código ZIP (`StudentSubmissionFlow`).
 *
 * @module StudentWorkspacePanel
 */

import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";

import { useSession } from "../shared/session/SessionContext";
import { StudentAssignmentsSection } from "./StudentAssignmentsSection";
import { StudentDeliveriesSection } from "./StudentDeliveriesSection";
import { StudentHomeSection } from "./StudentHomeSection";
import { StudentRecordSection } from "./StudentRecordSection";
import { StudentReportsSection } from "./StudentReportsSection";
import { StudentSubmissionFlow } from "./StudentSubmissionFlow";
import { useBuildRunStream } from "./hooks/useBuildRunStream";
import { useStudentWorkspaceData } from "./hooks/useStudentWorkspaceData";
import type { StudentTab } from "./studentTabs";

export function StudentWorkspacePanel(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as StudentTab) || "summary";
  const mainHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const { activeSession } = useSession();
  const workspaceData = useStudentWorkspaceData();

  const activeMonitoringRun =
    workspaceData.deliveries
      .map((delivery) => workspaceData.latestRunByDeliveryId[delivery.id] ?? null)
      .find((run) => Boolean(run && !run.isTerminal)) ?? null;
  const runMonitor = useBuildRunStream(activeMonitoringRun, activeSession);

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

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 lg:-my-8 flex flex-col">
      <a
        href="#student-workspace-main"
        className="sr-only rounded-full border border-primary bg-app-surface px-4 py-2 text-sm font-semibold text-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[150]"
      >
        Saltar al contenido principal
      </a>

      <main
        id="student-workspace-main"
        className="flex-1 space-y-6 p-5 lg:p-8"
      >
        <h2 ref={mainHeadingRef} tabIndex={-1} className="sr-only">
          Contenido principal del espacio del alumno: {activeTab}
        </h2>

        {activeTab === "summary" ? (
          <StudentHomeSection
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "proyectos" ? (
          <StudentAssignmentsSection
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "entregas" ? (
          <StudentDeliveriesSection
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "subir" ? (
          <StudentSubmissionFlow
            data={workspaceData}
            onNavigate={handleTabChange}
          />
        ) : null}
        {activeTab === "informes" ? (
          <StudentReportsSection data={workspaceData} />
        ) : null}
        {activeTab === "expediente" ? <StudentRecordSection /> : null}
      </main>
    </div>
  );
}
