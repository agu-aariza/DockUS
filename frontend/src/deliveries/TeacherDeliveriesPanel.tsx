import { type FormEvent, useEffect, useState } from "react";
import { builderApi } from "../shared/api/builderApi";
import {
  assignmentsApi,
  deliveriesApi,
  projectsApi,
} from "../shared/api/services";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { JsonResult } from "../shared/components/JsonResult";
import type {
  BuildRunEntity,
  DeliveryEntity,
  DeliveryStatus,
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  SessionRecord,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { hasRole } from "../shared/utils/permissions";
import { DeliveryReportView } from "./DeliveryReportView";

interface TeacherDeliveriesPanelProps {
  session: SessionRecord | null;
}

type NoticeTone = "info" | "warning";

interface NoticeState {
  text: string;
  tone: NoticeTone;
}

const DELIVERY_STATUSES: DeliveryStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "EVALUATED",
];

function formatProjectLabel(project: ProjectEntity): string {
  return `${project.title} · ${project.status}`;
}

function formatAssignmentLabel(assignment: ProjectAssignmentEntity): string {
  return `${assignment.studentEmail} · ${assignment.projectTitle}`;
}

export function TeacherDeliveriesPanel({
  session,
}: TeacherDeliveriesPanelProps): JSX.Element {
  const [projects, setProjects] = useState<ProjectEntity[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [myAssignments, setMyAssignments] = useState<ProjectAssignmentEntity[]>([]);
  const [deliveries, setDeliveries] =
    useState<PaginatedResponse<DeliveryEntity> | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [createForm, setCreateForm] = useState({
    assignmentId: "",
    status: "DRAFT" as DeliveryStatus,
    notes: "",
  });
  const [updateForm, setUpdateForm] = useState({
    id: "",
    status: "",
    notes: "",
  });
  const [statusForm, setStatusForm] = useState({
    id: "",
    status: "SUBMITTED" as DeliveryStatus,
  });
  const [restoreId, setRestoreId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] =
    useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [reportNotice, setReportNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [reportRun, setReportRun] = useState<BuildRunEntity | null>(null);
  const [reportDelivery, setReportDelivery] = useState<DeliveryEntity | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const canRead = Boolean(session);
  const canCreate = Boolean(session);
  const canWrite = hasRole(session, ["ADMIN", "TEACHER"]);
  const canAdmin = hasRole(session, ["ADMIN"]);

  useEffect(() => {
    if (!canRead) return;

    const loadProjects = async () => {
      try {
        const response = await projectsApi.list({
          page: 1,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "DESC",
        });
        setProjects(response.data);
        setDebugPayload(response);
        setSelectedProjectId((current) => current || response.data[0]?.id || "");
      } catch (error) {
        setWorkspaceNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadProjects();
  }, [canRead]);

  useEffect(() => {
    if (!session || session.role !== "STUDENT") return;

    const loadMyAssignments = async () => {
      try {
        const response = await assignmentsApi.listMine();
        setMyAssignments(response);
        if (!selectedProjectId) {
          setSelectedProjectId(response[0]?.projectId ?? "");
        }
      } catch (error) {
        setWorkspaceNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadMyAssignments();
  }, [selectedProjectId, session]);

  useEffect(() => {
    if (!selectedProjectId || !canRead) return;

    const loadAssignments = async () => {
      try {
        const response = canWrite
          ? await assignmentsApi.listByProject(selectedProjectId)
          : myAssignments.filter(
              (assignment) => assignment.projectId === selectedProjectId,
            );
        setAssignments(response);
        setSelectedAssignmentId((current) =>
          current && response.some((assignment) => assignment.id === current)
            ? current
            : response[0]?.id ?? "",
        );
        setWorkspaceNotice(null);
      } catch (error) {
        setWorkspaceNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadAssignments();
  }, [canRead, canWrite, myAssignments, selectedProjectId]);

  useEffect(() => {
    if (!selectedAssignmentId || !canRead) return;

    const loadDeliveries = async () => {
      try {
        const response = await deliveriesApi.list({
          assignmentId: selectedAssignmentId,
          page: 1,
          limit: 50,
          sortBy: "createdAt",
          sortOrder: "DESC",
        });
        setDeliveries(response);
        setDebugPayload(response);
        setSelectedDeliveryId((current) =>
          current && response.data.some((delivery) => delivery.id === current)
            ? current
            : response.data[0]?.id ?? "",
        );
      } catch (error) {
        setWorkspaceNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    setCreateForm((prev) => ({ ...prev, assignmentId: selectedAssignmentId }));
    void loadDeliveries();
  }, [canRead, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedDeliveryId) return;
    const selectedDelivery =
      deliveries?.data.find((delivery) => delivery.id === selectedDeliveryId) ?? null;
    if (!selectedDelivery) return;

    setUpdateForm({
      id: selectedDelivery.id,
      status: selectedDelivery.status,
      notes: selectedDelivery.notes ?? "",
    });
    setStatusForm({
      id: selectedDelivery.id,
      status: selectedDelivery.status,
    });
  }, [deliveries, selectedDeliveryId]);

  const selectedDelivery =
    deliveries?.data.find((delivery) => delivery.id === selectedDeliveryId) ?? null;

  const refreshDeliveries = async (assignmentId = selectedAssignmentId) => {
    if (!assignmentId || !canRead) return;

    try {
      const response = await deliveriesApi.list({
        assignmentId,
        page: 1,
        limit: 50,
        sortBy: "createdAt",
        sortOrder: "DESC",
      });
      setDeliveries(response);
      setDebugPayload(response);
      setWorkspaceNotice({
        text: "Entregas actualizadas.",
        tone: "info",
      });
      setSelectedDeliveryId((current) =>
        current && response.data.some((delivery) => delivery.id === current)
          ? current
          : response.data[0]?.id ?? "",
      );
    } catch (error) {
      setWorkspaceNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate || !createForm.assignmentId.trim()) return;

    try {
      const response = await deliveriesApi.create({
        assignmentId: createForm.assignmentId,
        status: createForm.status,
        notes: createForm.notes || undefined,
      });
      setEditorNotice({
        text: "Entrega creada correctamente.",
        tone: "info",
      });
      setDebugPayload(response);
      await refreshDeliveries(createForm.assignmentId);
      setSelectedDeliveryId(response.id);
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;

    try {
      const response = await deliveriesApi.update(updateForm.id.trim(), {
        status: updateForm.status
          ? (updateForm.status as DeliveryStatus)
          : undefined,
        notes: updateForm.notes || undefined,
      });
      setEditorNotice({
        text: "Entrega actualizada correctamente.",
        tone: "info",
      });
      setDebugPayload(response);
      await refreshDeliveries();
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;

    try {
      const response = await deliveriesApi.updateStatus(
        statusForm.id.trim(),
        statusForm.status,
      );
      setEditorNotice({
        text: "Estado de entrega actualizado.",
        tone: "info",
      });
      setDebugPayload(response);
      await refreshDeliveries();
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleRestore = async () => {
    if (!canAdmin || !restoreId.trim()) return;

    try {
      const response = await deliveriesApi.restore(restoreId.trim());
      setEditorNotice({
        text: "Entrega restaurada.",
        tone: "info",
      });
      setDebugPayload(response);
      await refreshDeliveries();
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const executeDelete = async () => {
    if (!canWrite || !deleteId.trim()) return;

    try {
      await deliveriesApi.remove(deleteId.trim());
      setEditorNotice({
        text: `Entrega ${deleteId.trim()} eliminada lógicamente.`,
        tone: "info",
      });
      await refreshDeliveries();
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
      throw error;
    }
  };

  const handleViewReport = async (deliveryId = selectedDeliveryId) => {
    if (!deliveryId || !canRead) return;
    setReportLoading(true);
    setReportNotice(null);
    setReportRun(null);
    setReportDelivery(null);

    try {
      const delivery = await deliveriesApi.detail(deliveryId);
      setReportDelivery(delivery);
      const runs = await builderApi.listByDelivery({
        deliveryId,
        limit: 1,
        sortOrder: "DESC",
      });
      const latestRun = runs.data[0] ?? null;
      if (!latestRun) {
        setReportNotice({
          text: "No hay runs registrados para esta entrega.",
          tone: "warning",
        });
        return;
      }
      const fullRun = await builderApi.detail(latestRun.id);
      setReportRun(fullRun);
      setDebugPayload(fullRun);
      setReportNotice({
        text: "Informe cargado.",
        tone: "info",
      });
    } catch (error) {
      setReportNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <div>
          <h2>Entregas</h2>
          <p className="hint">
            Flujo guiado desde proyecto hasta informe de evaluación.
          </p>
        </div>
        <p className="hint">
          Rol activo: <strong>{session?.role ?? "Sin sesión"}</strong>
        </p>
      </header>

      {session?.role === "STUDENT" && myAssignments.length > 0 ? (
        <article className="card stack">
          <h3>Mis asignaciones</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Alumno</th>
                  <th>Entregas</th>
                  <th>Restantes</th>
                </tr>
              </thead>
              <tbody>
                {myAssignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.projectTitle}</td>
                    <td>{assignment.studentEmail}</td>
                    <td>{assignment.deliveryCount}</td>
                    <td>{assignment.remainingDeliveries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <section className="grid two-col">
        <article className="card stack">
          <div className="panel-header">
            <h3>Ruta guiada</h3>
            <button
              className="btn ghost"
              onClick={() => void refreshDeliveries()}
              disabled={!selectedAssignmentId}
            >
              Refrescar entregas
            </button>
          </div>
          {workspaceNotice ? (
            <p className={`message ${workspaceNotice.tone}`}>
              {workspaceNotice.text}
            </p>
          ) : null}
          <label>
            Proyecto
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
            >
              <option value="">Selecciona un proyecto</option>
              {projects.map((project) => (
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
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {formatAssignmentLabel(assignment)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Entrega seleccionada
            <select
              value={selectedDeliveryId}
              onChange={(event) => setSelectedDeliveryId(event.target.value)}
              disabled={!deliveries?.data.length}
            >
              <option value="">Selecciona una entrega</option>
              {deliveries?.data.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  v{delivery.version} · {delivery.status}
                </option>
              ))}
            </select>
          </label>
          {selectedDelivery ? (
            <div className="grid two-col">
              <div className="builder-info">
                <strong>Autor</strong>
                <span>{selectedDelivery.studentEmail}</span>
              </div>
              <div className="builder-info">
                <strong>ID</strong>
                <span>{selectedDelivery.id}</span>
              </div>
            </div>
          ) : null}
        </article>

        <article className="card stack">
          <h3>Nueva entrega</h3>
          {editorNotice ? (
            <p className={`message ${editorNotice.tone}`}>{editorNotice.text}</p>
          ) : null}
          <form className="form" onSubmit={handleCreate}>
            <label>
              Asignación
              <select
                value={createForm.assignmentId}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    assignmentId: event.target.value,
                  }))
                }
              >
                <option value="">Selecciona una asignación</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {formatAssignmentLabel(assignment)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Estado inicial
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    status: event.target.value as DeliveryStatus,
                  }))
                }
              >
                {DELIVERY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notas
              <textarea
                value={createForm.notes}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>
            <button className="btn" type="submit" disabled={!canCreate}>
              Crear entrega
            </button>
          </form>
        </article>
      </section>

      <article className="card stack">
        <div className="panel-header">
          <h3>Entregas del contexto seleccionado</h3>
          <button
            className="btn ghost"
            disabled={!selectedDeliveryId}
            onClick={() => void handleViewReport()}
          >
            Ver informe
          </button>
        </div>
        {deliveries ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alumno</th>
                  <th>Versión</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>{delivery.id}</td>
                    <td>{delivery.studentEmail}</td>
                    <td>{delivery.version}</td>
                    <td>{delivery.status}</td>
                    <td>
                      <div className="row gap-8">
                        <button
                          className="btn ghost"
                          onClick={() => setSelectedDeliveryId(delivery.id)}
                        >
                          Seleccionar
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => void handleViewReport(delivery.id)}
                        >
                          Informe
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canWrite}
                          onClick={() => {
                            setDeleteId(delivery.id);
                            setConfirmOpen(true);
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">Selecciona proyecto y asignación para cargar entregas.</p>
        )}
      </article>

      <article className="card stack">
        <div className="panel-header">
          <h3>Informe de evaluación</h3>
          <span className="hint">
            Usa la pestaña Builder para lanzar o seguir runs en vivo.
          </span>
        </div>
        {reportNotice ? (
          <p className={`message ${reportNotice.tone}`}>{reportNotice.text}</p>
        ) : null}
        {reportLoading ? <p className="hint">Cargando informe...</p> : null}
        {reportRun ? (
          <DeliveryReportView
            run={reportRun}
            deliveryVersion={reportDelivery?.version}
          />
        ) : null}
      </article>

      <details className="card stack">
        <summary className="details-summary">Herramientas avanzadas</summary>
        <section className="grid two-col">
          <article className="stack">
            <h3>Editar entrega</h3>
            <form className="form" onSubmit={handleUpdate}>
              <label>
                Delivery ID
                <input
                  value={updateForm.id}
                  onChange={(event) =>
                    setUpdateForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                />
              </label>
              <label>
                Estado
                <select
                  value={updateForm.status}
                  onChange={(event) =>
                    setUpdateForm((prev) => ({
                      ...prev,
                      status: event.target.value,
                    }))
                  }
                >
                  <option value="">--</option>
                  {DELIVERY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Notas
                <textarea
                  value={updateForm.notes}
                  onChange={(event) =>
                    setUpdateForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                />
              </label>
              <button className="btn" type="submit" disabled={!canWrite}>
                Guardar edición
              </button>
            </form>
          </article>

          <article className="stack">
            <h3>Estado y recuperación</h3>
            <form className="form" onSubmit={handleStatusUpdate}>
              <label>
                Delivery ID
                <input
                  value={statusForm.id}
                  onChange={(event) =>
                    setStatusForm((prev) => ({ ...prev, id: event.target.value }))
                  }
                />
              </label>
              <label>
                Estado
                <select
                  value={statusForm.status}
                  onChange={(event) =>
                    setStatusForm((prev) => ({
                      ...prev,
                      status: event.target.value as DeliveryStatus,
                    }))
                  }
                >
                  {DELIVERY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn" type="submit" disabled={!canWrite}>
                Aplicar estado
              </button>
            </form>
            <label>
              Restore ID
              <input
                value={restoreId}
                onChange={(event) => setRestoreId(event.target.value)}
              />
            </label>
            <button className="btn ghost" disabled={!canAdmin} onClick={handleRestore}>
              Restaurar entrega
            </button>
          </article>
        </section>
        <JsonResult
          title="Última respuesta técnica"
          value={debugPayload ?? { message: "Sin payload de depuración." }}
        />
      </details>

      <DangerConfirmModal
        open={confirmOpen}
        title="Confirmar eliminación de entrega"
        description={`Se eliminará lógicamente la entrega ${deleteId}.`}
        confirmWord="DELETE"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDelete}
      />
    </section>
  );
}
