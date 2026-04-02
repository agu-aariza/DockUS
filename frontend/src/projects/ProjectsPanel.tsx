import { type FormEvent, useState } from 'react';
import { projectsApi } from '../shared/api/services';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import type {
  PaginatedResponse,
  ProjectEntity,
  ProjectStatus,
  SessionRecord,
} from '../shared/types';
import { getErrorMessage } from '../shared/utils/errors';
import { hasRole } from '../shared/utils/permissions';

interface ProjectsPanelProps {
  session: SessionRecord | null;
}

const PROJECT_STATUSES: ProjectStatus[] = ['DRAFT', 'ACTIVE', 'ARCHIVED'];

export function ProjectsPanel({ session }: ProjectsPanelProps): JSX.Element {
  const [query, setQuery] = useState({
    page: '1',
    limit: '20',
    status: '',
    creatorId: '',
    search: '',
    createdFrom: '',
    createdTo: '',
  });
  const [listResponse, setListResponse] =
    useState<PaginatedResponse<ProjectEntity> | null>(null);
  const [detailId, setDetailId] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '',
    contextAcademico: '',
    status: 'DRAFT' as ProjectStatus,
  });
  const [updateForm, setUpdateForm] = useState({
    id: '',
    title: '',
    contextAcademico: '',
    status: '',
  });
  const [statusForm, setStatusForm] = useState({
    id: '',
    status: 'ACTIVE' as ProjectStatus,
  });
  const [restoreId, setRestoreId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const canRead = Boolean(session);
  const canWrite = hasRole(session, ['ADMIN', 'TEACHER']);
  const canAdmin = hasRole(session, ['ADMIN']);

  const showError = (error: unknown) => setMessage(getErrorMessage(error));

  const handleList = async () => {
    if (!canRead) return;
    setMessage('');
    try {
      const response = await projectsApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        status: (query.status || undefined) as ProjectStatus | undefined,
        creatorId: query.creatorId || undefined,
        search: query.search || undefined,
        createdFrom: query.createdFrom || undefined,
        createdTo: query.createdTo || undefined,
      });
      setListResponse(response);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleDetail = async (inputId?: string) => {
    const targetId = (inputId ?? detailId).trim();
    if (!canRead || !targetId) return;
    setMessage('');
    try {
      const response = await projectsApi.detail(targetId);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    setMessage('');
    try {
      const response = await projectsApi.create({
        title: createForm.title,
        contextAcademico: createForm.contextAcademico || undefined,
        status: createForm.status,
      });
      setResult(response);
      setMessage('Proyecto creado correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    setMessage('');
    const payload: Record<string, string> = {};
    if (updateForm.title.trim()) payload.title = updateForm.title.trim();
    if (updateForm.contextAcademico.trim()) {
      payload.contextAcademico = updateForm.contextAcademico.trim();
    }
    if (updateForm.status) payload.status = updateForm.status;

    try {
      const response = await projectsApi.update(updateForm.id.trim(), payload);
      setResult(response);
      setMessage('Proyecto actualizado correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;
    setMessage('');
    try {
      const response = await projectsApi.updateStatus(
        statusForm.id.trim(),
        statusForm.status,
      );
      setResult(response);
      setMessage('Estado de proyecto actualizado.');
    } catch (error) {
      showError(error);
    }
  };

  const handleRestore = async () => {
    if (!canAdmin || !restoreId.trim()) return;
    setMessage('');
    try {
      const response = await projectsApi.restore(restoreId.trim());
      setResult(response);
      setMessage('Proyecto restaurado.');
    } catch (error) {
      showError(error);
    }
  };

  const openDeleteConfirm = (id: string) => {
    if (!canAdmin || !id.trim()) return;
    setDeleteId(id.trim());
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!canAdmin || !deleteId.trim()) return;
    try {
      await projectsApi.remove(deleteId.trim());
      setResult({ message: `Proyecto ${deleteId.trim()} eliminado (soft).` });
      setMessage('Proyecto eliminado lógicamente.');
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <h2>Projects</h2>
        <p>
          Rol activo: <strong>{session?.role ?? 'Sin sesión'}</strong>
        </p>
      </header>

      <article className="card">
        <h3>Listado</h3>
        <div className="grid four-col">
          <label>
            Page
            <input
              value={query.page}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, page: event.target.value }))
              }
            />
          </label>
          <label>
            Limit
            <input
              value={query.limit}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, limit: event.target.value }))
              }
            />
          </label>
          <label>
            Status
            <select
              value={query.status}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">--</option>
              {PROJECT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Creator ID
            <input
              value={query.creatorId}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, creatorId: event.target.value }))
              }
            />
          </label>
          <label>
            Search
            <input
              value={query.search}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </label>
          <label>
            Created from (ISO)
            <input
              value={query.createdFrom}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  createdFrom: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Created to (ISO)
            <input
              value={query.createdTo}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, createdTo: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="row gap-8">
          <button className="btn" onClick={handleList} disabled={!canRead}>
            Cargar proyectos
          </button>
          <span className="hint">{canRead ? 'Permitido' : 'Necesita sesión'}</span>
        </div>

        {listResponse ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Título</th>
                  <th>Status</th>
                  <th>Creator</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listResponse.data.map((project) => (
                  <tr key={project.id}>
                    <td>{project.id}</td>
                    <td>{project.title}</td>
                    <td>{project.status}</td>
                    <td>{project.creatorId}</td>
                    <td>
                      <div className="row gap-8">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setDetailId(project.id);
                            void handleDetail(project.id);
                          }}
                        >
                          Detail
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canAdmin}
                          onClick={() => openDeleteConfirm(project.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>

      <article className="card">
        <h3>Detalle por ID</h3>
        <div className="row gap-8">
          <input
            value={detailId}
            onChange={(event) => setDetailId(event.target.value)}
            placeholder="project uuid"
          />
          <button
            className="btn"
            onClick={() => {
              void handleDetail();
            }}
            disabled={!canRead}
          >
            Buscar
          </button>
        </div>
      </article>

      <section className="grid two-col">
        <article className="card">
          <h3>Crear</h3>
          <form className="form" onSubmit={handleCreate}>
            <label>
              Título
              <input
                required
                value={createForm.title}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                }
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
            <label>
              Status
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
            <button className="btn" type="submit" disabled={!canWrite}>
              Crear proyecto
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Actualizar</h3>
          <form className="form" onSubmit={handleUpdate}>
            <label>
              Project ID
              <input
                required
                value={updateForm.id}
                onChange={(event) =>
                  setUpdateForm((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label>
              Título
              <input
                value={updateForm.title}
                onChange={(event) =>
                  setUpdateForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </label>
            <label>
              Contexto académico
              <textarea
                value={updateForm.contextAcademico}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    contextAcademico: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Status (optional)
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
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={!canWrite}>
              Actualizar proyecto
            </button>
          </form>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h3>Cambio de estado</h3>
          <form className="form" onSubmit={handleStatusUpdate}>
            <label>
              Project ID
              <input
                required
                value={statusForm.id}
                onChange={(event) =>
                  setStatusForm((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label>
              Status
              <select
                value={statusForm.status}
                onChange={(event) =>
                  setStatusForm((prev) => ({
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
            <button className="btn" type="submit" disabled={!canWrite}>
              Aplicar estado
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Restore / Delete</h3>
          <div className="form">
            <label>
              Restore ID
              <input
                value={restoreId}
                onChange={(event) => setRestoreId(event.target.value)}
              />
            </label>
            <button className="btn" onClick={handleRestore} disabled={!canAdmin}>
              Restaurar proyecto
            </button>
            <label>
              Delete ID
              <input
                value={deleteId}
                onChange={(event) => setDeleteId(event.target.value)}
              />
            </label>
            <button
              className="btn danger"
              onClick={() => openDeleteConfirm(deleteId)}
              disabled={!canAdmin}
            >
              Eliminar (soft)
            </button>
          </div>
        </article>
      </section>

      {message ? <p className="message">{message}</p> : null}
      {result ? <JsonResult title="Resultado" value={result} /> : null}

      <DangerConfirmModal
        open={confirmOpen}
        title="Confirmar eliminación de proyecto"
        description={`Se eliminará lógicamente el proyecto ${deleteId}.`}
        confirmWord="DELETE"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDelete}
      />
    </section>
  );
}
