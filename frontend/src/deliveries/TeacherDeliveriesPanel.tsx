/**
 * @fileoverview Vista y gestión de entregas de código de alumnos (TeacherDeliveriesPanel).
 *
 * @module TeacherDeliveriesPanel
 */

import { useMemo } from "react";
import {
  RiInboxArchiveLine,
  RiStackFill,
  RiUser3Fill,
} from "react-icons/ri";
import { EmptyState } from "../shared/components/EmptyState";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import { TeacherGradingStudio } from "../shared/components/TeacherGradingStudio";
import { VisualPickerOption } from "../shared/components/ui/VisualPicker";
import { ProjectSelectionHub, type ProjectHubOption } from "../shared/components/ui/ProjectSelectionHub";
import { deliveriesApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { useToast } from "../shared/toast/ToastContext";
import { PageHeader } from "../shared/components/ui/PageHeader";

import { useDeliveriesPanel } from "./hooks/useDeliveriesPanel";
import { DeliveriesSidebar } from "./components/DeliveriesSidebar";
import { DeliveryDetailHeader } from "./components/DeliveryDetailHeader";
import { DeliveryOverview } from "./components/DeliveryOverview";
import { DeliveryGrading } from "./components/DeliveryGrading";
import { DeliveryReport } from "./components/DeliveryReport";

export function TeacherDeliveriesPanel(): JSX.Element {
  const panel = useDeliveriesPanel();
  const { pushToast } = useToast();

  const projectOptions: VisualPickerOption[] = useMemo(() => 
    panel.dc.projects.map(p => ({
      id: p.id,
      label: p.title,
      description: p.contextAcademico ? (p.contextAcademico.slice(0, 60) + (p.contextAcademico.length > 60 ? '...' : '')) : 'Sin descripción',
      icon: <RiStackFill />,
      badge: p.status,
    })), [panel.dc.projects]);

  const assignmentOptions: VisualPickerOption[] = useMemo(() => 
    panel.dc.assignments.map(a => ({
      id: a.id,
      label: a.studentName,
      description: a.studentEmail,
      icon: <RiUser3Fill />,
      badge: `${a.deliveryCount} entregas`,
    })), [panel.dc.assignments]);

  const hubProjects: ProjectHubOption[] = useMemo(() => 
    panel.dc.projects.map(p => ({
      id: p.id,
      title: p.title,
      description: p.contextAcademico || "Sin descripción operativa disponible.",
      studentCount: p.assignmentCount ?? 0,
      activeRuns: 0,
      status: p.status === 'ACTIVE' ? 'READY' : 'HALTED',
      teachers: p.teachers,
    })), [panel.dc.projects]);

  if (!panel.dc.selectedProjectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Gestión de Entregas"
          subtitle="Selecciona un proyecto para revisar la cola de entregas, calificar el trabajo de los alumnos y auditar el código."
          icon={<RiInboxArchiveLine />}
          badge={panel.dc.projects.length.toString()}
        />
        <section className="rounded-lg border border-app-border bg-white p-6">
          <ProjectSelectionHub
            projects={hubProjects}
            onSelect={(id, label) => panel.setProject(id, label)}
            title="Selecciona un proyecto para comenzar"
            subtitle="Activa un contexto de trabajo para abrir asignaciones, cargar entregas y revisar informes técnicos."
          />
        </section>
      </div>
    );
  }

  const navigateRuntime = () => {
    if (panel.selectedDelivery) {
      panel.dc.navigate(
        `/runtime?projectId=${panel.selectedDelivery.projectId}&assignmentId=${panel.selectedDelivery.assignmentId}&deliveryId=${panel.selectedDelivery.id}&autorun=1`,
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Gestión de Entregas"
        subtitle="Auditoría de entregas, flujo de calificación técnica y evaluación de evidencia académica."
        icon={<RiInboxArchiveLine />}
        badge={panel.deliveries.length.toString()}
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] items-start relative max-w-full">
        <DeliveriesSidebar
          projectOptions={projectOptions}
          assignmentOptions={assignmentOptions}
          deliverySearch={panel.deliverySearch}
          quickFilterKey={panel.quickFilterKey}
          visibleDeliveries={panel.visibleDeliveries}
          submittedCount={panel.submittedCount}
          reviewCount={panel.reviewCount}
          evaluatedCount={panel.evaluatedCount}
          loadingDeliveries={panel.dc.loadingDeliveries}
          selectedAssignment={panel.selectedAssignment}
          onRefreshDeliveries={() => void panel.dc.refreshDeliveries()}
          onProjectSelect={(id) => {
            const next = new URLSearchParams(panel.searchParams);
            next.set("projectId", id);
            panel.setSearchParams(next, { replace: true });
          }}
          onAssignmentSelect={(id, label) => panel.setAssignment(id, label)}
          onDeliverySearchChange={panel.setDeliverySearch}
          onQuickFilterChange={panel.setQuickFilterKey}
          openDelivery={panel.openDelivery}
          handleViewReport={(id) => void panel.dc.handleViewReport(id)}
          handleQuickGrade={panel.handleQuickGrade}
        />

        <section className="space-y-6">
          {!panel.selectedDelivery ? (
            <EmptyState
              icon={<RiInboxArchiveLine className="text-3xl text-slate-400" />}
              title="Terminal de Auditoría de Entregas"
              description="Seleccione un registro de la cola operativa para iniciar el proceso de revisión técnica y académica."
              actionLabel={panel.visibleDeliveries[0] ? "Empezar con la primera entrega" : undefined}
              onAction={
                panel.visibleDeliveries[0]
                  ? () => panel.openDelivery(panel.visibleDeliveries[0].id, "overview")
                  : undefined
              }
            />
          ) : (
            <>
              <DeliveryDetailHeader
                selectedDelivery={panel.selectedDelivery}
                detailTab={panel.detailTab}
                setDetailTab={(tab) => {
                  panel.setDetailTab(tab);
                  if (tab !== "overview" && panel.selectedDelivery) {
                    void panel.dc.handleViewReport(panel.selectedDelivery.id);
                  }
                }}
                handlePreview={panel.handlePreview}
                canWrite={panel.dc.canWrite}
                onNavigateRuntime={navigateRuntime}
              />

              {panel.detailTab === "overview" && (
                <DeliveryOverview
                  selectedDelivery={panel.selectedDelivery}
                  selectedProject={panel.selectedProject}
                  selectedAssignment={panel.selectedAssignment}
                  selectedDeliveryReviewNotes={panel.dc.selectedDeliveryReviewNotes}
                  canWrite={panel.dc.canWrite}
                  onRefreshDeliveries={() => void panel.dc.refreshDeliveries()}
                  onSetDetailTab={(tab) => {
                    panel.setDetailTab(tab);
                    if (tab !== "overview" && panel.selectedDelivery) {
                      void panel.dc.handleViewReport(panel.selectedDelivery.id);
                    }
                  }}
                  onNavigateRuntime={navigateRuntime}
                />
              )}

              {panel.detailTab === "grading" && (
                <DeliveryGrading
                  selectedDelivery={panel.selectedDelivery}
                  reportRun={panel.dc.reportRun}
                  selectedDeliveryReviewNotes={panel.dc.selectedDeliveryReviewNotes}
                  canWrite={panel.dc.canWrite}
                  gradingForm={panel.dc.gradingForm}
                  onSetGradingForm={panel.dc.setGradingForm}
                  onHandleGradingUpdate={panel.dc.handleGradingUpdate}
                />
              )}

              {panel.detailTab === "report" && (
                <DeliveryReport
                  selectedDelivery={panel.selectedDelivery}
                  reportRun={panel.dc.reportRun}
                  reportDeliveryVersion={panel.dc.reportDelivery?.version}
                  reportLoading={panel.dc.reportLoading}
                  selectedDeliveryReviewNotes={panel.dc.selectedDeliveryReviewNotes}
                  onHandleViewReport={(id, options) => void panel.dc.handleViewReport(id, options)}
                />
              )}
            </>
          )}
        </section>
      </div>
      {panel.dc.canWrite && panel.selectedDelivery ? (
        <TeacherGradingStudio
          isOpen={panel.isPreviewModalOpen}
          onClose={() => panel.setIsPreviewModalOpen(false)}
          delivery={panel.selectedDelivery}
          reportRun={panel.dc.reportRun}
          files={panel.previewFiles}
          isLoadingFiles={panel.isLoadingPreview}
          onSubmitGrading={async (grade, graderNotes) => {
            try {
              if (!panel.selectedDelivery) return;
              await deliveriesApi.updateGrading(panel.selectedDelivery.id, {
                grade: grade.trim() ? Number(grade) : null,
                graderNotes: graderNotes,
              });
              pushToast({
                title: "Calificación guardada",
                description: "La nota oficial ha sido consolidada.",
                tone: "success",
              });
              panel.setIsPreviewModalOpen(false);
              await panel.dc.refreshDeliveries();
            } catch (error) {
              pushToast({
                title: "Error al calificar",
                description: getErrorMessage(error),
                tone: "error",
              });
            }
          }}
          initialGrade={panel.dc.gradingForm.grade}
          initialNotes={panel.dc.gradingForm.graderNotes}
        />
      ) : (
        <CodePreviewModal
          isOpen={panel.isPreviewModalOpen}
          onClose={() => panel.setIsPreviewModalOpen(false)}
          title="Explorador de Entrega"
          subtitle={panel.selectedDelivery ? `v${panel.selectedDelivery.version} — ${panel.selectedDelivery.studentName}` : ""}
          isLoading={panel.isLoadingPreview}
          files={panel.previewFiles}
        />
      )}
    </div>
  );
}
