import { type FormEvent, useEffect, useState } from "react";
import {
  assignmentsApi,
  projectsApi,
  usersApi,
} from "../shared/api/services";
import { DangerConfirmModal } from "../shared/components/DangerConfirmModal";
import { JsonResult } from "../shared/components/JsonResult";
import type {
  PaginatedResponse,
  ProjectAssignmentEntity,
  ProjectEntity,
  ProjectStatus,
  SessionRecord,
  StorageObjectEntity,
  UserEntity,
} from "../shared/types";
import { getErrorMessage } from "../shared/utils/errors";
import { hasRole } from "../shared/utils/permissions";
import { ProgressDashboard } from "./ProgressDashboard";

interface TeacherProjectsPanelProps {
  session: SessionRecord | null;
}

type NoticeTone = "info" | "warning";

interface NoticeState {
  text: string;
  tone: NoticeTone;
}

const PROJECT_STATUSES: ProjectStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

function formatProjectLabel(project: ProjectEntity): string {
  return `${project.title} · ${project.status}`;
}

function formatStudentLabel(student: UserEntity): string {
  return `${student.firstName} ${student.lastName}`.trim()
    ? `${student.firstName} ${student.lastName}`.trim()
    : student.email;
}

export function TeacherProjectsPanel({
  session,
}: TeacherProjectsPanelProps): JSX.Element {
  const [projects, setProjects] =
    useState<PaginatedResponse<ProjectEntity> | null>(null);
  const [students, setStudents] = useState<UserEntity[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [assignmentsResult, setAssignmentsResult] =
    useState<ProjectAssignmentEntity[] | null>(null);
  const [testSuiteFile, setTestSuiteFile] = useState<File | null>(null);
  const [testSuiteResult, setTestSuiteResult] =
    useState<StorageObjectEntity | { message: string } | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
  });
  const [editForm, setEditForm] = useState({
    title: "",
    contextAcademico: "",
    status: "DRAFT" as ProjectStatus,
    maxDeliveriesPerStudent: "1",
  });
  const [deleteId, setDeleteId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectNotice, setProjectNotice] = useState<NoticeState | null>(null);
  const [assignmentNotice, setAssignmentNotice] =
    useState<NoticeState | null>(null);
  const [suiteNotice, setSuiteNotice] = useState<NoticeState | null>(null);
  const [editorNotice, setEditorNotice] = useState<NoticeState | null>(null);
  const [debugPayload, setDebugPayload] = useState<unknown>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const canRead = Boolean(session);
  const canWrite = hasRole(session, ["ADMIN", "TEACHER"]);
  const canAdmin = hasRole(session, ["ADMIN"]);

  const selectedProject =
    projects?.data.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!canRead) return;

    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const response = await projectsApi.list({
          page: 1,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "DESC",
        });
        setProjects(response);
        setDebugPayload(response);
        setProjectNotice(null);
        setSelectedProjectId((current) =>
          current && response.data.some((project) => project.id === current)
            ? current
            : response.data[0]?.id ?? "",
        );
      } catch (error) {
        setProjectNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      } finally {
        setLoadingProjects(false);
      }
    };

    void loadProjects();
  }, [canRead]);

  useEffect(() => {
    if (!canWrite) return;

    const loadStudents = async () => {
      setLoadingStudents(true);
      try {
        const response = await usersApi.list({
          page: 1,
          limit: 100,
          role: "STUDENT",
          sortBy: "createdAt",
          sortOrder: "DESC",
        });
        setStudents(response.data);
        setAssignmentNotice(null);
      } catch (error) {
        setAssignmentNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [canWrite]);

  useEffect(() => {
    if (!selectedProject) return;

    setEditForm({
      title: selectedProject.title,
      contextAcademico: selectedProject.contextAcademico ?? "",
      status: selectedProject.status,
      maxDeliveriesPerStudent: String(selectedProject.maxDeliveriesPerStudent),
    });

    if (!canWrite) {
      return;
    }

    const loadAssignments = async () => {
      try {
        const response = await assignmentsApi.listByProject(selectedProject.id);
        setAssignmentsResult(response);
      } catch (error) {
        setAssignmentNotice({
          text: getErrorMessage(error),
          tone: "warning",
        });
      }
    };

    void loadAssignments();
  }, [canWrite, selectedProject]);

  const refreshProjects = async (noticeText?: string) => {
    if (!canRead) return;
    setLoadingProjects(true);
    try {
      const response = await projectsApi.list({
        page: 1,
        limit: 50,
        sortBy: "updatedAt",
        sortOrder: "DESC",
      });
      setProjects(response);
      setDebugPayload(response);
      setProjectNotice(
        noticeText
          ? {
              text: noticeText,
              tone: "info",
            }
          : null,
      );
      setSelectedProjectId((current) =>
        current && response.data.some((project) => project.id === current)
          ? current
          : response.data[0]?.id ?? "",
      );
    } catch (error) {
      setProjectNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const refreshAssignments = async (projectId = selectedProjectId) => {
    if (!canWrite || !projectId) return;
    try {
      const response = await assignmentsApi.listByProject(projectId);
      setAssignmentsResult(response);
      setAssignmentNotice({
        text: "Asignaciones actualizadas.",
        tone: "info",
      });
      setDebugPayload(response);
    } catch (error) {
      setAssignmentNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;

    try {
      const response = await projectsApi.create({
        title: createForm.title,
        contextAcademico: createForm.contextAcademico || undefined,
        status: createForm.status,
        maxDeliveriesPerStudent:
          Number(createForm.maxDeliveriesPerStudent) || 1,
      });
      setCreateForm({
        title: "",
        contextAcademico: "",
        status: "DRAFT",
        maxDeliveriesPerStudent: "1",
      });
      setDebugPayload(response);
      setEditorNotice({
        text: "Proyecto creado correctamente.",
        tone: "info",
      });
      await refreshProjects("Listado actualizado tras crear el proyecto.");
      setSelectedProjectId(response.id);
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedProject) return;

    try {
      const response = await projectsApi.update(selectedProject.id, {
        title: editForm.title,
        contextAcademico: editForm.contextAcademico || undefined,
        status: editForm.status,
        maxDeliveriesPerStudent: Number(editForm.maxDeliveriesPerStudent) || 1,
      });
      setDebugPayload(response);
      setEditorNotice({
        text: "Proyecto actualizado correctamente.",
        tone: "info",
      });
      await refreshProjects("Datos del proyecto actualizados.");
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleAssignStudents = async () => {
    if (!canWrite || !selectedProject || selectedStudentIds.length === 0) return;

    try {
      const response = await assignmentsApi.bulkAssign(
        selectedProject.id,
        selectedStudentIds,
      );
      setAssignmentsResult(response);
      setDebugPayload(response);
      setAssignmentNotice({
        text: "Asignaciones actualizadas correctamente.",
        tone: "info",
      });
    } catch (error) {
      setAssignmentNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleUploadTestSuite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedProject || !testSuiteFile) return;

    try {
      const response = await projectsApi.uploadTestSuite(
        selectedProject.id,
        testSuiteFile,
      );
      setTestSuiteResult(response);
      setDebugPayload(response);
      setSuiteNotice({
        text: "Suite docente subida correctamente.",
        tone: "info",
      });
    } catch (error) {
      setSuiteNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleFetchTestSuite = async () => {
    if (!canWrite || !selectedProject) return;

    try {
      const response = await projectsApi.getTestSuite(selectedProject.id);
      setTestSuiteResult(response);
      setDebugPayload(response);
      setSuiteNotice({
        text: "Suite docente recuperada.",
        tone: "info",
      });
    } catch (error) {
      setSuiteNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const handleRemoveTestSuite = async () => {
    if (!canWrite || !selectedProject) return;

    try {
      const response = await projectsApi.removeTestSuite(selectedProject.id);
      setTestSuiteResult(response);
      setDebugPayload(response);
      setSuiteNotice({
        text: "Suite docente eliminada.",
        tone: "info",
      });
    } catch (error) {
      setSuiteNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
    }
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;

    try {
      await projectsApi.remove(deleteId.trim());
      setEditorNotice({
        text: `Proyecto ${deleteId.trim()} eliminado lógicamente.`,
        tone: "info",
      });
      setDeleteId("");
      await refreshProjects("Listado actualizado tras eliminar el proyecto.");
    } catch (error) {
      setEditorNotice({
        text: getErrorMessage(error),
        tone: "warning",
      });
      throw error;
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <div>
          <h2>Proyectos</h2>
          <p className="hint">
            Centro docente para preparar laboratorios, cupos y suites de tests.
          </p>
        </div>
      </header>

      <section className="grid two-col">
        <article className="card stack">
          <div className="panel-header">
            <h3>Proyecto activo</h3>
            <button
              className="btn ghost"
              onClick={() => void refreshProjects()}
              disabled={!canRead || loadingProjects}
            >
              {loadingProjects ? "Actualizando..." : "Actualizar listado"}
            </button>
          </div>
          {projectNotice ? (
            <p className={`message ${projectNotice.tone}`}>{projectNotice.text}</p>
          ) : null}
          <label>
            Selección guiada
            <select
              value={selectedProjectId}
              onChange={(event) => setSelectedProjectId(event.target.value)}
              disabled={!projects?.data.length}
            >
              <option value="">Selecciona un proyecto</option>
              {projects?.data.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatProjectLabel(project)}
                </option>
              ))}
            </select>
          </label>
          {selectedProject ? (
            <>
              <div className="grid two-col">
                <div className="builder-info">
                  <strong>Estado</strong>
                  <span>{selectedProject.status}</span>
                </div>
                <div className="builder-info">
                  <strong>Máx. entregas</strong>
                  <span>{selectedProject.maxDeliveriesPerStudent}</span>
                </div>
                <div className="builder-info">
                  <strong>Contexto</strong>
                  <span>{selectedProject.contextAcademico ?? "Sin contexto"}</span>
                </div>
                <div className="builder-info">
                  <strong>ID</strong>
                  <span>{selectedProject.id}</span>
                </div>
              </div>
              <div className="row gap-8">
                <button
                  className="btn ghost"
                  disabled={!canWrite}
                  onClick={() => void refreshAssignments()}
                >
                  Ver asignaciones
                </button>
                <button
                  className="btn ghost"
                  disabled={!canWrite}
                  onClick={() => void handleFetchTestSuite()}
                >
                  Consultar suite
                </button>
                <button
                  className="btn danger"
                  disabled={!canAdmin}
                  onClick={() => {
                    setDeleteId(selectedProject.id);
                    setConfirmOpen(true);
                  }}
                >
                  Eliminar proyecto
                </button>
              </div>
            </>
          ) : (
            <p className="hint">Selecciona un proyecto para activar el flujo guiado.</p>
          )}
        </article>

        <article className="card stack">
          <h3>Crear proyecto</h3>
          {editorNotice ? (
            <p className={`message ${editorNotice.tone}`}>{editorNotice.text}</p>
          ) : null}
          <form className="form" onSubmit={handleCreate}>
            <label>
              Título
              <input
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                }
                required
              />
            </label>
            <label>
              Contexto académico
              <textarea
                value={createForm.contextAcademico}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    contextAcademico: event.target.value,
                  }))
                }
              />
            </label>
            <div className="grid two-col">
              <label>
                Estado inicial
                <select
                  value={createForm.status}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      status: event.target.value as ProjectStatus,
                    }))
                  }
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Máx. entregas por alumno
                <input
                  value={createForm.maxDeliveriesPerStudent}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      maxDeliveriesPerStudent: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
            <button className="btn" type="submit" disabled={!canWrite}>
              Crear proyecto
            </button>
          </form>
        </article>
      </section>

      <ProgressDashboard
        session={session}
        projectOptions={projects?.data ?? []}
        selectedProjectId={selectedProjectId}
      />

      <section className="grid two-col">
        <article className="card stack">
          <div className="panel-header">
            <h3>Asignar alumnado</h3>
            <button
              className="btn ghost"
              disabled={!canWrite || loadingStudents}
              onClick={() => {
                if (!canWrite) return;
                setLoadingStudents(true);
                void usersApi
                  .list({
                    page: 1,
                    limit: 100,
                    role: "STUDENT",
                    sortBy: "createdAt",
                    sortOrder: "DESC",
                  })
                  .then((response) => setStudents(response.data))
                  .catch((error) =>
                    setAssignmentNotice({
                      text: getErrorMessage(error),
                      tone: "warning",
                    }),
                  )
                  .finally(() => setLoadingStudents(false));
              }}
            >
              {loadingStudents ? "Cargando..." : "Recargar alumnado"}
            </button>
          </div>
          {assignmentNotice ? (
            <p className={`message ${assignmentNotice.tone}`}>
              {assignmentNotice.text}
            </p>
          ) : null}
          <label>
            Alumnado disponible
            <select
              multiple
              className="multi-select"
              value={selectedStudentIds}
              onChange={(event) =>
                setSelectedStudentIds(
                  Array.from(event.target.selectedOptions, (option) => option.value),
                )
              }
              disabled={!selectedProject || !students.length}
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {formatStudentLabel(student)} · {student.email}
                </option>
              ))}
            </select>
          </label>
          <div className="row gap-8">
            <button
              className="btn"
              type="button"
              disabled={!canWrite || !selectedProject || selectedStudentIds.length === 0}
              onClick={() => void handleAssignStudents()}
            >
              Asignar seleccionados
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!canWrite || !selectedProject}
              onClick={() => void refreshAssignments()}
            >
              Refrescar tabla
            </button>
          </div>

          {assignmentsResult ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Entregas</th>
                    <th>Restantes</th>
                    <th>Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentsResult.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>{assignment.studentEmail}</td>
                      <td>{assignment.deliveryCount}</td>
                      <td>{assignment.remainingDeliveries}</td>
                      <td>{assignment.minimumRequirementMet ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        <article className="card stack">
          <h3>Editar proyecto seleccionado</h3>
          <p className="hint">
            El formulario toma como base el proyecto que está activo arriba.
          </p>
          <form className="form" onSubmit={handleUpdate}>
            <label>
              Título
              <input
                value={editForm.title}
                onChange={(event) =>
                  setEditForm((prev) => ({ ...prev, title: event.target.value }))
                }
                disabled={!selectedProject}
              />
            </label>
            <label>
              Contexto académico
              <textarea
                value={editForm.contextAcademico}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    contextAcademico: event.target.value,
                  }))
                }
                disabled={!selectedProject}
              />
            </label>
            <div className="grid two-col">
              <label>
                Estado
                <select
                  value={editForm.status}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      status: event.target.value as ProjectStatus,
                    }))
                  }
                  disabled={!selectedProject}
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Máx. entregas por alumno
                <input
                  value={editForm.maxDeliveriesPerStudent}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      maxDeliveriesPerStudent: event.target.value,
                    }))
                  }
                  disabled={!selectedProject}
                />
              </label>
            </div>
            <button className="btn" type="submit" disabled={!canWrite || !selectedProject}>
              Guardar cambios
            </button>
          </form>
        </article>
      </section>

      <article className="card stack">
        <h3>Suite docente</h3>
        {suiteNotice ? (
          <p className={`message ${suiteNotice.tone}`}>{suiteNotice.text}</p>
        ) : null}
        <p className="hint">
          La suite se gestiona siempre sobre el proyecto seleccionado.
        </p>
        <form className="form" onSubmit={handleUploadTestSuite}>
          <label>
            Archivo .zip o .tar.gz
            <input
              type="file"
              accept=".zip,.tar.gz"
              onChange={(event) => setTestSuiteFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="row gap-8">
            <button className="btn" type="submit" disabled={!canWrite || !selectedProject}>
              Subir suite
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!canWrite || !selectedProject}
              onClick={() => void handleFetchTestSuite()}
            >
              Ver suite
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={!canWrite || !selectedProject}
              onClick={() => void handleRemoveTestSuite()}
            >
              Eliminar suite
            </button>
          </div>
        </form>
        {testSuiteResult ? (
          <div className="grid two-col">
            {"id" in testSuiteResult ? (
              <>
                <div className="builder-info">
                  <strong>Archivo</strong>
                  <span>{testSuiteResult.logicalName}</span>
                </div>
                <div className="builder-info">
                  <strong>Tamaño</strong>
                  <span>{testSuiteResult.sizeBytes} bytes</span>
                </div>
              </>
            ) : (
              <p className="hint">{testSuiteResult.message}</p>
            )}
          </div>
        ) : null}
      </article>

      <details className="card stack">
        <summary className="details-summary">Herramientas avanzadas</summary>
        <p className="hint">
          JSON técnico y listado completo para depuración o soporte.
        </p>
        {projects ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Estado</th>
                  <th>Máx.</th>
                </tr>
              </thead>
              <tbody>
                {projects.data.map((project) => (
                  <tr key={project.id}>
                    <td>{project.id}</td>
                    <td>{project.title}</td>
                    <td>{project.status}</td>
                    <td>{project.maxDeliveriesPerStudent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <JsonResult
          title="Última respuesta técnica"
          value={debugPayload ?? { message: "Sin payload de depuración." }}
        />
      </details>

      <DangerConfirmModal
        open={confirmOpen}
        title="Eliminar proyecto"
        description={`Se eliminará lógicamente el proyecto ${deleteId}.`}
        confirmWord="DELETE"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDelete}
      />
    </section>
  );
}
