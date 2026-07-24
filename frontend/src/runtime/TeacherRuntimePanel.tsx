/**
 * @fileoverview Panel de estado del runtime y Docker daemon (TeacherRuntimePanel).
 *
 * @module TeacherRuntimePanel
 */

import {
  RiArrowRightUpLine,
  RiCodeSSlashLine,
  RiLoader4Line,
  RiPlayLine,
  RiPulseFill,
  RiRefreshLine,
  RiStackFill,
  RiStopLine,
  RiUser3Fill,
} from "react-icons/ri";
import { useState, useEffect, useMemo } from "react";
import { BuilderLiveRunPane } from "../builder/components/BuilderLiveRunPane";
import { BuilderRunsTable } from "../builder/components/BuilderRunsTable";
import { CodePreviewModal } from "../shared/components/CodePreviewModal";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { useToast } from "../shared/toast/ToastContext";
import { useRuntimeManagement } from "./hooks/useRuntimeManagement";
import { useWorkspaceSelection } from "../shared/workspace/WorkspaceContext";
import { deliveriesApi } from "../shared/api/services";
import { getErrorMessage } from "../shared/utils/errors";
import { StatusBadge } from "../shared/components/ui/StatusBadge";
import { VisualPicker, type VisualPickerOption } from "../shared/components/ui/VisualPicker";
import { ProjectSelectionHub, type ProjectHubOption } from "../shared/components/ui/ProjectSelectionHub";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { Tabs } from "../shared/components/ui/Tabs";
import { RuntimeStatusBar } from "./components/RuntimeStatusBar";

type RuntimeTab = "control" | "history" | "live";

function formatStudentName(name?: string, email?: string) {
  if (!name || name === "Estudiante" || name.includes("@")) return email || "Sin identificar";
  return name;
}

export function TeacherRuntimePanel(): JSX.Element {
  const rc = useRuntimeManagement();
  const { selection, setProject, setAssignment, setDelivery, setRun } = useWorkspaceSelection();
  const [activeTab, setActiveTab] = useState<RuntimeTab>("control");
  const { pushToast } = useToast();

  // Code preview state
  const [isCodePreviewOpen, setIsCodePreviewOpen] = useState(false);
  const [codePreviewFiles, setCodePreviewFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [isLoadingCodePreview, setIsLoadingCodePreview] = useState(false);

  const handleOpenCodePreview = async () => {
    if (!rc.selectedDeliveryId) return;
    setIsLoadingCodePreview(true);
    setIsCodePreviewOpen(true);
    try {
      const files = await deliveriesApi.preview(rc.selectedDeliveryId);
      setCodePreviewFiles(files);
    } catch (error) {
      pushToast({
        title: "Error previsualizando código",
        description: getErrorMessage(error),
        tone: "error",
      });
      setIsCodePreviewOpen(false);
    } finally {
      setIsLoadingCodePreview(false);
    }
  };

  useNoticeToasts([rc.message], "Runtime");

  // Sync down
  useEffect(() => {
    if (selection.projectId && selection.projectId !== rc.selectedProjectId) {
      rc.setSelectedProjectId(selection.projectId);
    }
  }, [selection.projectId]);

  useEffect(() => {
    if (selection.assignmentId && selection.assignmentId !== rc.selectedAssignmentId) {
      rc.setSelectedAssignmentId(selection.assignmentId);
    }
  }, [selection.assignmentId]);

  useEffect(() => {
    if (selection.deliveryId && selection.deliveryId !== rc.selectedDeliveryId) {
      rc.setSelectedDeliveryId(selection.deliveryId);
    }
  }, [selection.deliveryId]);

  useEffect(() => {
    if (selection.lastRunId && selection.lastRunId !== rc.selectedRunId) {
      rc.setSelectedRunId(selection.lastRunId);
    }
  }, [selection.lastRunId]);

  // Sync up
  useEffect(() => {
    if (rc.selectedProjectId && rc.selectedProjectId !== selection.projectId) {
      const p = rc.projectOptions.find(x => x.id === rc.selectedProjectId);
      setProject(rc.selectedProjectId, p?.title);
    }
  }, [rc.selectedProjectId, rc.projectOptions]);

  useEffect(() => {
    if (rc.selectedAssignmentId && rc.selectedAssignmentId !== selection.assignmentId) {
      const a = rc.assignmentOptions.find(x => x.id === rc.selectedAssignmentId);
      setAssignment(rc.selectedAssignmentId, a?.studentEmail);
    }
  }, [rc.selectedAssignmentId, rc.assignmentOptions]);

  useEffect(() => {
    if (rc.selectedDeliveryId && rc.selectedDeliveryId !== selection.deliveryId) {
      const d = rc.deliveryOptions.find(x => x.id === rc.selectedDeliveryId);
      setDelivery(rc.selectedDeliveryId, d ? `v${d.version} - ${d.status}` : undefined);
    }
  }, [rc.selectedDeliveryId, rc.deliveryOptions]);

  useEffect(() => {
    if (rc.selectedRunId && rc.selectedRunId !== selection.lastRunId) {
      setRun(rc.selectedRunId);
    }
  }, [rc.selectedRunId]);

  const selectedProject = rc.projectOptions.find(
    (project) => project.id === rc.selectedProjectId,
  );
  const selectedAssignment = rc.assignmentOptions.find(
    (assignment) => assignment.id === rc.selectedAssignmentId,
  );
  const selectedDelivery = rc.deliveryOptions.find(
    (delivery) => delivery.id === rc.selectedDeliveryId,
  );

  const runs = rc.runsResponse?.data ?? [];

  const projectOptions: VisualPickerOption[] = useMemo(() =>
    rc.projectOptions.map(p => ({
      id: p.id,
      label: p.title,
      description: p.contextAcademico ? (p.contextAcademico.slice(0, 60) + (p.contextAcademico.length > 60 ? '...' : '')) : 'Sin descripción académica',
      icon: <RiStackFill />,
      badge: p.status,
    })), [rc.projectOptions]);

  const assignmentOptions: VisualPickerOption[] = useMemo(() =>
    rc.assignmentOptions.map(a => ({
      id: a.id,
      label: formatStudentName(a.studentName, a.studentEmail),
      description: a.studentEmail,
      icon: <RiUser3Fill />,
      badge: a.deliveryCount > 0 ? `${a.deliveryCount} entregas` : 'Sin entregas',
    })), [rc.assignmentOptions]);

  const deliveryOptions: VisualPickerOption[] = useMemo(() =>
    rc.deliveryOptions.map(d => ({
      id: d.id,
      label: `Versión ${d.version}`,
      description: `Creada: ${new Date(d.createdAt).toLocaleDateString()}`,
      icon: <RiPulseFill />,
      badge: d.status,
      badgeTone: d.status === 'SUBMITTED' ? 'success' : d.status === 'EVALUATED' ? 'info' : 'default',
    })), [rc.deliveryOptions]);

  const hubProjects: ProjectHubOption[] = useMemo(() =>
    rc.projectOptions.map(p => ({
      id: p.id,
      title: p.title,
      description: p.contextAcademico || "Sin descripción operativa disponible.",
      studentCount: p.assignmentCount ?? 0,
      activeRuns: 0,
      status: "READY" as const,
      teachers: p.teachers,
    })), [rc.projectOptions]);

  if (!rc.selectedProjectId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Runtime Operativo"
          subtitle="Selecciona un proyecto para ejecutar evaluaciones de entregas y revisar runs en tiempo real."
          icon={<RiPulseFill />}
          badge={rc.projectOptions.length.toString()}
        />
        <section className="card p-6 sm:p-8">
          <ProjectSelectionHub
            projects={hubProjects}
            onSelect={(id) => rc.setSelectedProjectId(id)}
            title="Selecciona un proyecto para comenzar"
            subtitle="Activa un contexto de runtime para preparar ejecuciones, lanzar evaluaciones y monitorear resultados."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runtime Operativo"
        subtitle="Ejecuta evaluaciones de entregas y audita builder runs en tiempo real."
        icon={<RiPulseFill />}
        actions={
          <Tabs
            tabs={[
              { id: "control", label: "Control", icon: RiPlayLine },
              { id: "history", label: "Historial", icon: RiArrowRightUpLine },
              { id: "live", label: "En vivo", icon: RiRefreshLine },
            ]}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as RuntimeTab)}
            variant="primary"
          />
        }
      />

      <RuntimeStatusBar
        runCount={runs.length}
        streamState={rc.streamState}
        latestSequence={rc.latestSequence}
      />

      {activeTab === "control" ? (
        <section className="card">
          <div className="panel-header bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <RiPlayLine className="text-lg" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Evaluación Integral</h2>
                <p className="text-sm text-slate-500">Ejecución de código y evaluación por LLM en tiempo real.</p>
              </div>
            </div>
            <StatusBadge tone="success">READY</StatusBadge>
          </div>

          <div className="p-6 space-y-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="runtime-project-picker" className="label-text">Proyecto de Referencia</label>
                <VisualPicker
                  id="runtime-project-picker"
                  options={projectOptions}
                  value={rc.selectedProjectId}
                  onSelect={(id) => rc.setSelectedProjectId(id)}
                  placeholder="Selecciona un proyecto..."
                  searchPlaceholder="Buscar por título o contexto..."
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="runtime-assignment-picker" className="label-text">Alumno Asignado</label>
                <VisualPicker
                  id="runtime-assignment-picker"
                  options={assignmentOptions}
                  value={rc.selectedAssignmentId}
                  onSelect={(id) => rc.setSelectedAssignmentId(id)}
                  placeholder="Selecciona un alumno..."
                  searchPlaceholder="Buscar por nombre o email..."
                  className={!rc.selectedProjectId ? 'opacity-50 grayscale pointer-events-none' : ''}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="runtime-delivery-picker" className="label-text">Versión de Entrega</label>
                <VisualPicker
                  id="runtime-delivery-picker"
                  options={deliveryOptions}
                  value={rc.selectedDeliveryId}
                  onSelect={(id) => rc.setSelectedDeliveryId(id)}
                  placeholder="Selecciona versión..."
                  searchPlaceholder="Buscar versión o estado..."
                  className={!rc.selectedAssignmentId ? 'opacity-50 grayscale pointer-events-none' : ''}
                />
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-app-border bg-slate-50 p-5">
                <div className="eyebrow mb-2">Contexto Académico</div>
                <div className="text-base font-semibold text-slate-900 mb-2">
                  {selectedProject?.title ?? "Sin proyecto seleccionado"}
                </div>
                <p className="text-sm leading-relaxed text-slate-500">
                  {selectedProject?.contextAcademico ??
                    "El contexto académico del proyecto define los objetivos y restricciones de la ejecución."}
                </p>
              </div>

              <div className="rounded-lg border border-app-border bg-slate-50 p-5">
                <div className="eyebrow mb-3">Resumen de Destino</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Modo Ejecución:</span>
                    <span className="font-semibold text-success-600">Efímero / Aislado</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Alumno:</span>
                    <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                      {formatStudentName(selectedAssignment?.studentName, selectedAssignment?.studentEmail)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Entrega:</span>
                    <span className="font-semibold text-accent">
                      {selectedDelivery ? `v${selectedDelivery.version} (${selectedDelivery.status})` : "n/a"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 pt-6 border-t border-app-border sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setActiveTab("live");
                  void rc.handleStartRun();
                }}
                disabled={!rc.selectedDeliveryId || rc.busyAction === "run"}
                variant="primary"
                size="md"
              >
                {rc.busyAction === "run" ? (
                  <RiLoader4Line className="animate-spin text-xl" />
                ) : (
                  <RiPlayLine className="text-xl" />
                )}
                Lanzar Evaluación
              </Button>

              {rc.selectedRunId && !rc.selectedRun?.isTerminal && (
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => void rc.handleCancelRun()}
                  disabled={rc.busyAction === "cancel"}
                  variant="danger"
                  size="md"
                >
                  {rc.busyAction === "cancel" ? (
                    <RiLoader4Line className="animate-spin text-lg" />
                  ) : (
                    <RiStopLine className="text-lg" />
                  )}
                  Abortar Run
                </Button>
              )}
            </div>

            {rc.streamError ? (
              <div className="rounded-md border border-danger-200 bg-danger-50 p-4 text-sm text-danger-800">
                Error en stream SSE: {rc.streamError}. El sistema ha conmutado a modo de actualización manual (polling).
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="space-y-4">
          <div>
            <h3 className="section-heading">Historial de Ejecuciones</h3>
            <p className="section-copy">Registros históricos de runs realizados para esta entrega.</p>
          </div>
          <div className="card">
            <BuilderRunsTable
              runs={runs}
              busyAction={rc.busyAction}
              selectedRunId={rc.selectedRunId}
              onSelectRun={(id) => {
                rc.setSelectedRunId(id);
                setActiveTab("live");
              }}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "live" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="section-heading">Ejecución en Vivo</h3>
              <p className="section-copy">Monitorización en tiempo real vía SSE.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {rc.selectedDeliveryId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleOpenCodePreview()}
                  disabled={isLoadingCodePreview}
                >
                  {isLoadingCodePreview ? (
                    <RiLoader4Line className="animate-spin" />
                  ) : (
                    <RiCodeSSlashLine />
                  )}
                  Ver código
                </Button>
              )}
              {rc.selectedRunId && (
                <span className="inline-flex items-center rounded-full border border-accent/10 bg-accent-subtle px-3 py-1.5 text-xs font-semibold text-accent">
                  Run: {rc.selectedRunId.slice(0, 12)}
                </span>
              )}
            </div>
          </div>
          <div className="card min-h-[500px]">
            <BuilderLiveRunPane
              selectedRun={rc.selectedRun}
              liveEvents={rc.liveEvents}
              streamState={rc.streamState}
              streamError={rc.streamError}
              evidenceArtifacts={rc.evidenceArtifacts}
              evidenceLoading={rc.evidenceLoading}
              evidenceError={rc.evidenceError}
              downloadingArtifactId={rc.downloadingArtifactId}
              previewingArtifact={rc.previewingArtifact}
              previewLoading={rc.previewLoading}
              onPreviewArtifact={(artifactId) =>
                void rc.handlePreviewArtifact(artifactId)
              }
              onClosePreview={() => rc.setPreviewingArtifact(null)}
              onDownloadArtifact={(artifactId) =>
                void rc.handleDownloadArtifact(artifactId)
              }
              onRefresh={() => void rc.loadRuns()}
              onCancel={() => void rc.handleCancelRun()}
              busyAction={rc.busyAction}
            />
          </div>
        </section>
      ) : null}

      <CodePreviewModal
        isOpen={isCodePreviewOpen}
        onClose={() => setIsCodePreviewOpen(false)}
        title="Código de la Entrega"
        subtitle={`v${selectedDelivery?.version ?? "?"} — ${selectedDelivery?.studentEmail ?? "Selecciona una entrega"}`}
        isLoading={isLoadingCodePreview}
        files={codePreviewFiles}
      />
    </div>
  );
}
