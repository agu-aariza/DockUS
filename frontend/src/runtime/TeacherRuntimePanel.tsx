import {
  RiArrowRightUpLine,
  RiLoader4Line,
  RiPlayLine,
  RiRefreshLine,
  RiServerLine,
  RiStopLine,
} from "react-icons/ri";
import { useState, useEffect } from "react";
import { BuilderLiveRunPane } from "../builder/components/BuilderLiveRunPane";
import { BuilderRunsTable } from "../builder/components/BuilderRunsTable";
import type {
  ProjectRuntimeEnvironmentStatus,
  ProjectRuntimeNetworkSummary,
  SessionRecord,
} from "../shared/types";
import { useNoticeToasts } from "../shared/toast/useNoticeToasts";
import { useRuntimeManagement } from "./hooks/useRuntimeManagement";
import { useWorkspace } from "../shared/workspace/WorkspaceContext";

interface TeacherRuntimePanelProps {
  session: SessionRecord | null;
}

type RuntimeTab = "control" | "infraestructura" | "seguimiento";
type RuntimeTrackingTab = "historial" | "ejecucion";

const RUNTIME_STATUS_STYLES: Record<ProjectRuntimeEnvironmentStatus, string> = {
  ABSENT: "border-slate-200 bg-slate-100 text-slate-700",
  PROVISIONING: "border-sky-200 bg-sky-50 text-sky-700",
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
  DELETING: "border-amber-200 bg-amber-50 text-amber-700",
};

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper?: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </div>
      {helper ? (
        <div className="mt-2 text-sm text-slate-500">{helper}</div>
      ) : null}
    </div>
  );
}

function NetworkCard({
  network,
}: {
  network: ProjectRuntimeNetworkSummary;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight text-slate-950">
            {network.name}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
            {network.scope}
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
          {network.containers.length} contenedor{network.containers.length === 1 ? "" : "es"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {network.containers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No hay contenedores vivos en esta red.
          </div>
        ) : (
          network.containers.map((container) => (
            <div
              key={container.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">
                    {container.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {container.status} · id {container.id.slice(0, 12)}
                  </div>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-600">
                  restart {container.restartCount}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TeacherRuntimePanel({ session }: TeacherRuntimePanelProps): JSX.Element {
  const rc = useRuntimeManagement(session);
  const { selection, setProject, setAssignment, setDelivery, setRun } = useWorkspace();
  const [activeTab, setActiveTab] = useState<RuntimeTab>("control");
  const [trackingTab, setTrackingTab] = useState<RuntimeTrackingTab>("historial");

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
  const activeNetworks = rc.runtimeStatus?.networks ?? [];
  const activeRuns = rc.runtimeStatus?.activeRuns ?? [];

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="eyebrow">Runtime por proyecto</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Ejecuta entregas dentro del runtime Docker del proyecto y sigue el run sin salir de la interfaz.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esta vista está pensada para trabajo docente real: selección del proyecto,
              sincronización de redes, seguimiento de contenedores y consola live sobre el mismo run.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="btn-secondary"
              onClick={() => void rc.refreshRuntimeStatus()}
              disabled={!rc.selectedProjectId}
            >
              <RiRefreshLine />
              Actualizar runtime
            </button>
            <button
              className="btn-secondary"
              onClick={() => void rc.loadRuns()}
              disabled={!rc.selectedDeliveryId}
            >
              <RiArrowRightUpLine />
              Recargar historial
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Estado del runtime"
          value={runtimeStatus}
          helper={rc.runtimeStatus?.workspaceNetworkName ?? "Sin red workspace asociada"}
        />
        <MetricCard
          label="Redes activas"
          value={activeNetworks.length}
          helper="Workspace + runs efímeros"
        />
        <MetricCard
          label="Runs activos"
          value={activeRuns.length}
          helper="Dentro del proyecto seleccionado"
        />
        <MetricCard
          label="Secuencia SSE"
          value={rc.latestSequence}
          helper={`stream ${rc.streamState}`}
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {[
          { id: "control", label: "Control" },
          { id: "infraestructura", label: "Infraestructura" },
          { id: "seguimiento", label: "Seguimiento" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-b-2 border-slate-900 text-slate-950"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab(tab.id as RuntimeTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "control" ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="panel-header">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Contexto de ejecución
              </h3>
              <p className="section-copy">
                Selecciona proyecto, asignación y entrega antes de lanzar el run.
              </p>
            </div>
            <span className={`status-chip ${runtimeStyle}`}>{runtimeStatus}</span>
          </div>

          <div className="space-y-5 p-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <div>
                <label className="label-text">Proyecto</label>
                <select
                  className="input-field"
                  value={rc.selectedProjectId}
                  onChange={(event) => rc.setSelectedProjectId(event.target.value)}
                >
                  <option value="">Selecciona un proyecto</option>
                  {rc.projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">Asignación</label>
                <select
                  className="input-field"
                  value={rc.selectedAssignmentId}
                  onChange={(event) => rc.setSelectedAssignmentId(event.target.value)}
                  disabled={!rc.selectedProjectId}
                >
                  <option value="">Selecciona una asignación</option>
                  {rc.assignmentOptions.map((assignment) => (
                    <option key={assignment.id} value={assignment.id}>
                      {assignment.studentEmail}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">Entrega</label>
                <select
                  className="input-field"
                  value={rc.selectedDeliveryId}
                  onChange={(event) => rc.setSelectedDeliveryId(event.target.value)}
                  disabled={!rc.selectedAssignmentId}
                >
                  <option value="">Selecciona una entrega</option>
                  {rc.deliveryOptions.map((delivery) => (
                    <option key={delivery.id} value={delivery.id}>
                      v{delivery.version} · {delivery.status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Proyecto actual
                </div>
                <div className="mt-2 text-base font-semibold tracking-tight text-slate-950">
                  {selectedProject?.title ?? "Sin selección"}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedProject?.contextAcademico ??
                    "Selecciona un proyecto para ver su contexto académico y estado operativo."}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  Target del runtime
                </div>
                <div className="mt-2 text-sm text-slate-700">
                  <div>
                    <span className="font-medium text-slate-950">Red workspace:</span>{" "}
                    {rc.runtimeStatus?.workspaceNetworkName ?? "n/a"}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium text-slate-950">Alumno:</span>{" "}
                    {selectedAssignment?.studentEmail ?? "n/a"}
                  </div>
                  <div className="mt-1">
                    <span className="font-medium text-slate-950">Entrega:</span>{" "}
                    {selectedDelivery ? `v${selectedDelivery.version} · ${selectedDelivery.status}` : "n/a"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="btn-primary"
                onClick={() => {
                  setActiveTab("seguimiento");
                  setTrackingTab("ejecucion");
                  void rc.handleStartRun();
                }}
                disabled={!rc.selectedDeliveryId || runtimeStatus !== "READY" || rc.busyAction === "run"}
              >
                {rc.busyAction === "run" ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiPlayLine />
                )}
                Correr ejecución
              </button>
              <button
                className="btn-secondary"
                onClick={() => void rc.handleReconcile()}
                disabled={!rc.selectedProjectId || rc.busyAction === "reconcile"}
              >
                {rc.busyAction === "reconcile" ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiRefreshLine />
                )}
                Preparar/Reintentar runtime
              </button>
              <button
                className="btn-secondary"
                onClick={() => void rc.handleCancelRun()}
                disabled={!rc.selectedRunId || !rc.selectedRun || rc.selectedRun.isTerminal || rc.busyAction === "cancel"}
              >
                {rc.busyAction === "cancel" ? (
                  <RiLoader4Line className="animate-spin" />
                ) : (
                  <RiStopLine />
                )}
                Cancelar run
              </button>
            </div>

            {runtimeStatus !== "READY" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                El runtime Docker del proyecto no está listo. Puedes sincronizarlo desde aquí antes de lanzar la ejecución.
              </div>
            ) : null}

            {rc.streamError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                SSE degradado. Se sigue actualizando por polling: {rc.streamError}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "infraestructura" ? (
        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="panel-header">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                Estado del runtime
              </h3>
              <p className="section-copy">
                Redes temporales, contenedores activos y runs vivos del proyecto.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
              <RiServerLine />
              {rc.runtimeStatus?.workspaceNetworkName ?? "sin red"}
            </div>
          </div>

          <div className="space-y-5 p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Runs activos
              </div>
              {activeRuns.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  No hay runs activos para el proyecto seleccionado.
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {activeRuns.map((run) => (
                    <button
                      key={run.buildRunId}
                      className="flex w-full items-start justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-slate-300"
                      onClick={() => {
                        rc.setSelectedRunId(run.buildRunId);
                        setActiveTab("seguimiento");
                        setTrackingTab("ejecucion");
                      }}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-950">
                          {run.buildRunId.slice(0, 8)} · {run.status}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          red {run.executionNetworkName ?? "n/a"} · contenedor {run.primaryContainerId ?? "resolviendo"}
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
                        {run.activeStage ?? "sin etapa"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {activeNetworks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Sin redes vivas para este proyecto.
                </div>
              ) : (
                activeNetworks.map((network) => (
                  <NetworkCard key={network.name} network={network} />
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "seguimiento" ? (
      <section className="space-y-5">
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {[
            { id: "historial", label: "Historial de ejecuciones" },
            { id: "ejecucion", label: "Ejecución en vivo" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`px-4 py-3 text-sm font-semibold transition ${
                trackingTab === tab.id
                  ? "border-b-2 border-slate-900 text-slate-950"
                  : "text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setTrackingTab(tab.id as RuntimeTrackingTab)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {trackingTab === "historial" ? (
          <BuilderRunsTable
            runs={runs}
            busyAction={rc.busyAction}
            selectedRunId={rc.selectedRunId}
            onSelectRun={rc.setSelectedRunId}
          />
        ) : (
          <BuilderLiveRunPane
            selectedRun={rc.selectedRun}
            liveEvents={rc.liveEvents}
            streamState={rc.streamState}
            onRefresh={() => void rc.loadRuns()}
            onCancel={() => void rc.handleCancelRun()}
            busyAction={rc.busyAction}
          />
        )}
      </section>
      ) : null}
    </div>
  );
}
