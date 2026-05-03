import {
  RiArrowRightUpLine,
  RiLoader4Line,
  RiPlayLine,
  RiPulseFill,
  RiRefreshLine,
  RiServerLine,
  RiStackFill,
  RiStopLine,
  RiUser3Fill,
} from "react-icons/ri";
import { useState, useEffect, useMemo } from "react";
import { BuilderLiveRunPane } from "../builder/components/BuilderLiveRunPane";
import { BuilderRunsTable } from "../builder/components/BuilderRunsTable";
import type {
  ProjectRuntimeEnvironmentStatus,
  SessionRecord,
} from "../shared/types";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { useRuntimeManagement } from "./hooks/useRuntimeManagement";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";
import { MetricCard } from "../shared/components/MetricCard";
import { VisualPicker, type VisualPickerOption } from "../shared/components/ui/VisualPicker";
import { ProjectSelectionHub, type ProjectHubOption } from "../shared/components/ui/ProjectSelectionHub";
import { PageHeader } from "../shared/components/ui/PageHeader";
import { Button } from "../shared/components/ui/Button";
import { Tabs } from "../shared/components/ui/Tabs";

interface TeacherRuntimePanelProps {
  session: SessionRecord | null;
}

const RUNTIME_STATUS_STYLES: Record<ProjectRuntimeEnvironmentStatus, string> = {
  ABSENT: "border-slate-200 bg-slate-50 text-slate-500",
  PROVISIONING: "border-brand-blue/20 bg-brand-blue/5 text-brand-blue-dark",
  READY: "border-brand-gold/20 bg-brand-gold/5 text-brand-gold-dark",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
  DELETING: "border-amber-200 bg-amber-50 text-amber-700",
};

function formatStudentName(name?: string, email?: string) {
  if (!name || name === "Estudiante" || name.includes("@")) return email || "Sin identificar";
  return name;
}

type RuntimeTab = "control" | "history" | "live";

export function TeacherRuntimePanel({ session }: TeacherRuntimePanelProps): JSX.Element {
  const rc = useRuntimeManagement(session);
  const { selection, setProject, setAssignment, setDelivery, setRun } = useWorkspace();
  const [activeTab, setActiveTab] = useState<RuntimeTab>("control");

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
  const runtimeStatus = rc.runtimeStatus?.status ?? "ABSENT";
  const runtimeStyle = RUNTIME_STATUS_STYLES[runtimeStatus];
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
      studentCount: (p as any).assignmentCount || 0,
      activeRuns: 0, 
      status: p.runtimeEnvironmentStatus as any || 'ABSENT',
      teachers: p.teachers,
    })), [rc.projectOptions]);

  if (!rc.selectedProjectId) {
    return (
      <div className="space-y-8 animate-fade-in">
        <PageHeader
          title="Runtime Operativo"
          subtitle="Selecciona un proyecto para gestionar despliegues, monitorear ejecuciones y calificar entregas técnicas."
          icon={<RiPulseFill />}
          badge={rc.projectOptions.length.toString()}
        />
        <section className="rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <ProjectSelectionHub
            projects={hubProjects}
            onSelect={(id) => rc.setSelectedProjectId(id)}
            title="Selecciona un proyecto para comenzar"
            subtitle="Activa un contexto de runtime para preparar infraestructura, lanzar runs y monitorear ejecución en vivo."
          />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Runtime Operativo"
        subtitle="Evaluación integral mediante ejecución efímera en contenedores aislados y auditoría por LLM."
        icon={<RiPulseFill />}
        badge={runtimeStatus}
        actions={
          <div className="flex items-center gap-3">
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
            <Button
              variant="secondary"
              className="!h-11 px-4"
              onClick={() => void rc.refreshRuntimeStatus()}
              disabled={!rc.selectedProjectId}
            >
              <RiRefreshLine className={rc.busyAction === 'refresh' ? 'animate-spin' : ''} />
              Sincronizar
            </Button>
          </div>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Estado Plataforma"
          value={runtimeStatus === 'READY' ? 'OPERATIVA' : runtimeStatus}
          helper="Motor de ejecución efímera"
          icon={<RiPulseFill />}
          variant={runtimeStatus === 'READY' ? 'info' : 'warning'}
        />
        <MetricCard
          label="Capacidad Evaluación"
          value="LLM + Docker"
          helper="Análisis integral activo"
          icon={<RiServerLine />}
          variant="info"
        />
        <MetricCard
          label="Runs Recientes"
          value={runs.length}
          helper="Procesos en este proyecto"
          icon={<RiPlayLine />}
          variant="default"
        />
        <MetricCard
          label="Flujo SSE"
          value={rc.latestSequence}
          helper={rc.streamState === 'streaming' ? 'Conexión activa' : 'Esperando stream'}
          icon={<RiRefreshLine />}
          variant={rc.streamState === 'streaming' ? 'info' : 'default'}
        />
      </div>

      {activeTab === "control" ? (
        <section className="rounded-[2.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden animate-fade-in">
          <div className="bg-brand-maroon p-8 text-white">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold-light text-xl">
                  <RiPlayLine />
                </div>
                <div>
                  <h4 className="text-xl font-bold tracking-tight">Evaluación Integral</h4>
                  <p className="text-sm text-slate-400">Ejecución efímera de código y evaluación por LLM en tiempo real.</p>
                </div>
              </div>
              <span className={`rounded-full border px-4 py-1.5 text-xs font-bold ${runtimeStyle}`}>
                {runtimeStatus}
              </span>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <label className="ui-label ml-1">Proyecto de Referencia</label>
                <VisualPicker
                  options={projectOptions}
                  value={rc.selectedProjectId}
                  onSelect={(id) => rc.setSelectedProjectId(id)}
                  placeholder="Selecciona un proyecto..."
                  searchPlaceholder="Buscar por título o contexto..."
                />
              </div>
              <div className="space-y-3">
                <label className="ui-label ml-1">Alumno Asignado</label>
                <VisualPicker
                  options={assignmentOptions}
                  value={rc.selectedAssignmentId}
                  onSelect={(id) => rc.setSelectedAssignmentId(id)}
                  placeholder="Selecciona un alumno..."
                  searchPlaceholder="Buscar por nombre o email..."
                  className={!rc.selectedProjectId ? 'opacity-50 grayscale pointer-events-none' : ''}
                />
              </div>
              <div className="space-y-3">
                <label className="ui-label ml-1">Versión de Entrega</label>
                <VisualPicker
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
              <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
                <div className="eyebrow mb-3">Contexto Académico</div>
                <div className="text-base font-bold tracking-tight text-slate-900 mb-2">
                  {selectedProject?.title ?? "Sin proyecto seleccionado"}
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  {selectedProject?.contextAcademico ??
                    "El contexto académico del proyecto define los objetivos y restricciones de la ejecución."}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-6">
                <div className="eyebrow mb-3">Resumen de Destino</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Modo Ejecución:</span>
                    <span className="font-bold text-emerald-600">Efímero / Aislado</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Alumno:</span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px]">
                      {formatStudentName(selectedAssignment?.studentName, selectedAssignment?.studentEmail)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-500">Entrega:</span>
                    <span className="font-bold text-brand-maroon">
                      {selectedDelivery ? `v${selectedDelivery.version} (${selectedDelivery.status})` : "n/a"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-6 pt-8 border-t border-slate-100 sm:flex-row">
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                <Button
                  className="px-10 flex-1 sm:flex-none"
                  onClick={() => {
                    setActiveTab("live");
                    void rc.handleStartRun();
                  }}
                  disabled={!rc.selectedDeliveryId || runtimeStatus !== "READY" || rc.busyAction === "run"}
                  variant="primary"
                >
                  {rc.busyAction === "run" ? (
                    <RiLoader4Line className="animate-spin text-2xl" />
                  ) : (
                    <RiPlayLine className="text-2xl" />
                  )}
                  Lanzar Evaluación
                </Button>
              </div>

              {rc.selectedRunId && !rc.selectedRun?.isTerminal && (
                <Button
                  className="px-8 w-full sm:w-auto"
                  onClick={() => void rc.handleCancelRun()}
                  disabled={rc.busyAction === "cancel"}
                  variant="danger"
                >
                  {rc.busyAction === "cancel" ? (
                    <RiLoader4Line className="animate-spin text-xl" />
                  ) : (
                    <RiStopLine className="text-xl" />
                  )}
                  Abortar Run
                </Button>
              )}
            </div>

            {runtimeStatus !== "READY" && rc.selectedProjectId ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-sm text-amber-800">
                <RiServerLine className="text-lg" />
                <span>El motor de ejecución no está listo. Contacta con soporte técnico si el problema persiste.</span>
              </div>
            ) : null}

            {rc.streamError ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-800">
                Error en stream SSE: {rc.streamError}. El sistema ha conmutado a modo de actualización manual (polling).
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="animate-fade-in">
          <div className="mb-6 px-2">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">Historial de Ejecuciones</h3>
            <p className="text-sm text-slate-500">Registros históricos de todos los runs realizados para esta entrega.</p>
          </div>
          <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm">
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
        <section className="animate-fade-in">
          <div className="mb-6 px-2 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-slate-950">Ejecución en Vivo</h3>
              <p className="text-sm text-slate-500">Monitorización en tiempo real vía SSE.</p>
            </div>
            {rc.selectedRunId && (
               <div className="text-xs font-bold text-brand-maroon bg-brand-maroon/5 px-3 py-1.5 rounded-xl border border-brand-maroon/10">
                 Run: {rc.selectedRunId.slice(0, 12)}
               </div>
            )}
          </div>
          <div className="rounded-[2.5rem] border border-slate-200 bg-white overflow-hidden shadow-sm min-h-[500px]">
            <BuilderLiveRunPane
              selectedRun={rc.selectedRun}
              liveEvents={rc.liveEvents}
              streamState={rc.streamState}
              onRefresh={() => void rc.loadRuns()}
              onCancel={() => void rc.handleCancelRun()}
              busyAction={rc.busyAction}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
