import { useEffect, useState } from "react";
import { builderApi } from "../shared/api/builderApi";
import {
  assignmentsApi,
  deliveriesApi,
  projectsApi,
} from "../shared/api/services";
import { JsonResult } from "../shared/components/JsonResult";
import type {
  BuildRunEntity,
  DeliveryEntity,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { BuilderControlCard } from "./components/BuilderControlCard";
import { BuilderLiveRunPane } from "./components/BuilderLiveRunPane";
import { BuilderRunsTable } from "./components/BuilderRunsTable";
import { useBuilderRunStream } from "./hooks/useBuilderRunStream";

interface TeacherBuilderPanelProps {
  session: SessionRecord | null;
}

type NoticeTone = "info" | "warning";

interface NoticeState {
  text: string;
  tone: NoticeTone;
}

function formatProjectLabel(project: ProjectEntity): string {
  return `${project.title} · ${project.status}`;
}

function formatAssignmentLabel(assignment: ProjectAssignmentEntity): string {
  return `${assignment.studentEmail} · ${assignment.projectTitle}`;
}

function formatDeliveryLabel(delivery: DeliveryEntity): string {
  return `v${delivery.version} · ${delivery.status} · ${delivery.studentEmail}`;
}

export function TeacherBuilderPanel({
  session,
}: TeacherBuilderPanelProps): JSX.Element {
  const [projectOptions, setProjectOptions] = useState<ProjectEntity[]>([]);
  const [assignmentOptions, setAssignmentOptions] = useState<ProjectAssignmentEntity[]>(
    [],
  );
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryEntity[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [deliveryId, setDeliveryId] = useState("");
  const [runsResponse, setRunsResponse] =
    useState<PaginatedResponse<BuildRunEntity> | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [selectedRun, setSelectedRun] = useState<BuildRunEntity | null>(null);
  const [message, setMessage] = useState<NoticeState | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [studentAssignments, setStudentAssignments] = useState<
    ProjectAssignmentEntity[]
  >([]);

  const { events, streamState, streamError, latestSequence } =
    useBuilderRunStream(selectedRunId, session);

  const canUseBuilder = Boolean(session);
  const runs = runsResponse?.data ?? [];
  const liveEvents = [...events].slice(-40).reverse();

  useEffect(() => {
    if (!canUseBuilder) return;

    const loadProjects = async () => {
      try {
        const response = await projectsApi.list({
          page: 1,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "DESC",
        });
        setProjectOptions(response.data);
        setDebugPayload(response);
        setSelectedProjectId((current) => current || response.data[0]?.id || "");
      } catch (error) {
        setMessage({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadProjects();
  }, [canUseBuilder]);

  useEffect(() => {
    if (!session || session.role !== "STUDENT") return;

    const loadMine = async () => {
      try {
        const response = await assignmentsApi.listMine();
        setStudentAssignments(response);
      } catch (error) {
        setMessage({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadMine();
  }, [session]);

  useEffect(() => {
    if (!selectedProjectId || !canUseBuilder) return;

    const loadAssignments = async () => {
      try {
        const response =
          session?.role === "STUDENT"
            ? studentAssignments.filter(
                (assignment) => assignment.projectId === selectedProjectId,
              )
            : await assignmentsApi.listByProject(selectedProjectId);
        setAssignmentOptions(response);
        setSelectedAssignmentId((current) =>
          current && response.some((assignment) => assignment.id === current)
            ? current
            : response[0]?.id ?? "",
        );
      } catch (error) {
        setMessage({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadAssignments();
  }, [canUseBuilder, selectedProjectId, session?.role, studentAssignments]);

  useEffect(() => {
    if (!selectedAssignmentId || !canUseBuilder) return;

    const loadDeliveries = async () => {
      try {
        const response = await deliveriesApi.list({
          assignmentId: selectedAssignmentId,
          page: 1,
          limit: 50,
          sortBy: "createdAt",
          sortOrder: "DESC",
        });
        setDeliveryOptions(response.data);
        setDeliveryId((current) =>
          current && response.data.some((delivery) => delivery.id === current)
            ? current
            : response.data[0]?.id ?? "",
        );
      } catch (error) {
        setMessage({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadDeliveries();
  }, [canUseBuilder, selectedAssignmentId]);

  const showError = (error: unknown) =>
    setMessage({
      text: getErrorMessage(error),
      tone: "warning",
    });

  const loadRuns = async () => {
    if (!deliveryId.trim() || !canUseBuilder) {
      return;
    }
    setMessage(null);
    try {
      const response = await builderApi.listByDelivery({
        deliveryId: deliveryId.trim(),
        page: 1,
        limit: 20,
      });
      setRunsResponse(response);
      setDebugPayload(response);
      if (!selectedRunId && response.data[0]) {
        setSelectedRunId(response.data[0].id);
      }
    } catch (error) {
      showError(error);
    }
  };

  const loadRunDetail = async (buildRunId: string) => {
    if (!buildRunId.trim() || !canUseBuilder) {
      return;
    }
    try {
      const response = await builderApi.detail(buildRunId.trim());
      setSelectedRun(response);
      setDebugPayload(response);
    } catch (error) {
      showError(error);
    }
  };

  useEffect(() => {
    if (!selectedRunId || !canUseBuilder) {
      setSelectedRun(null);
      return;
    }

    let disposed = false;
    const sync = async () => {
      const response = await builderApi.detail(selectedRunId);
      if (!disposed) {
        setSelectedRun(response);
      }
    };

    void sync().catch(showError);
    const interval = window.setInterval(() => {
      void sync().catch(showError);
    }, 3000);

    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [selectedRunId, canUseBuilder]);

  const handleStartRun = async () => {
    if (!deliveryId.trim() || !canUseBuilder) {
      return;
    }
    setBusyAction("run");
    setMessage(null);
    try {
      const response = await builderApi.runForDelivery(deliveryId.trim());
      setSelectedRunId(response.buildRunId);
      setMessage({
        text: `Run encolado: ${response.buildRunId}`,
        tone: "info",
      });
      await loadRuns();
      await loadRunDetail(response.buildRunId);
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async () => {
    if (!selectedRunId || !canUseBuilder) {
      return;
    }
    setBusyAction("cancel");
    setMessage(null);
    try {
      await builderApi.cancel(selectedRunId);
      setMessage({
        text: "Run cancelado.",
        tone: "info",
      });
      await loadRunDetail(selectedRunId);
      await loadRuns();
    } catch (error) {
      showError(error);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <div>
          <h2>Builder</h2>
          <p className="hint">
            Selección guiada de proyecto, asignación y entrega antes del run.
          </p>
        </div>
      </header>

      {message ? <p className={`message ${message.tone}`}>{message.text}</p> : null}
      {streamError ? <p className="message warning">{streamError}</p> : null}

      <article className="card stack">
        <div className="panel-header">
          <h3>Ruta guiada</h3>
          <button
            className="btn ghost"
            disabled={!deliveryId}
            onClick={() => void loadRuns()}
          >
            Cargar historial
          </button>
        </div>
        <div className="grid two-col">
          <label>
            Proyecto
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              <option value="">Selecciona un proyecto</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatProjectLabel(project)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Asignación
            <select
              value={selectedAssignmentId}
              onChange={(event) => setSelectedAssignmentId(event.target.value)}
            >
              <option value="">Selecciona una asignación</option>
              {assignmentOptions.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {formatAssignmentLabel(assignment)}
                </option>
              ))}
            </select>
          </label>
          <label className="full-width">
            Entrega
            <select
              value={deliveryId}
              onChange={(event) => setDeliveryId(event.target.value)}
            >
              <option value="">Selecciona una entrega</option>
              {deliveryOptions.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {formatDeliveryLabel(delivery)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <BuilderControlCard
        deliveryId={deliveryId}
        canUseBuilder={canUseBuilder}
        busyAction={busyAction}
        streamState={streamState}
        latestSequence={latestSequence}
        onDeliveryIdChange={setDeliveryId}
        onStartRun={() => {
          void handleStartRun();
        }}
        onLoadRuns={() => {
          void loadRuns();
        }}
      />

      <BuilderRunsTable
        runs={runs}
        busyAction={busyAction}
        onSelectRun={setSelectedRunId}
      />

      <BuilderLiveRunPane
        selectedRun={selectedRun}
        liveEvents={liveEvents}
        streamState={streamState}
        busyAction={busyAction}
        onRefresh={() => {
          if (selectedRunId) {
            void loadRunDetail(selectedRunId);
          }
        }}
        onCancel={() => {
          void handleCancel();
        }}
      />

      <details className="card stack">
        <summary className="details-summary">Depuración avanzada</summary>
        <JsonResult
          title="Última respuesta técnica"
          value={debugPayload ?? { message: "Sin payload de depuración." }}
        />
      </details>
    </section>
  );
}
