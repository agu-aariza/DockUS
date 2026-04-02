import { type FormEvent, useState } from 'react';
import { deliveriesApi } from '../shared/api/services';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import type {
  DeliveryEntity,
  DeliveryStatus,
  PaginatedResponse,
  SessionRecord,
} from '../shared/types';
import { getErrorMessage } from '../shared/utils/errors';
import { hasRole } from '../shared/utils/permissions';

interface DeliveriesPanelProps {
  session: SessionRecord | null;
}

const DELIVERY_STATUSES: DeliveryStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'EVALUATED',
];

export function DeliveriesPanel({ session }: DeliveriesPanelProps): JSX.Element {
  const [query, setQuery] = useState({
    page: '1',
    limit: '20',
    projectId: '',
    authorId: '',
    status: '',
  });
  const [listResponse, setListResponse] =
    useState<PaginatedResponse<DeliveryEntity> | null>(null);
  const [detailId, setDetailId] = useState('');
  const [createForm, setCreateForm] = useState({
    projectId: '',
    version: '1',
    status: 'DRAFT' as DeliveryStatus,
    notes: '',
  });
  const [updateForm, setUpdateForm] = useState({
    id: '',
    version: '',
    status: '',
    notes: '',
  });
  const [statusForm, setStatusForm] = useState({
    id: '',
    status: 'SUBMITTED' as DeliveryStatus,
  });
  const [restoreId, setRestoreId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const canRead = Boolean(session);
  const canCreate = Boolean(session);
  const canWrite = hasRole(session, ['ADMIN', 'TEACHER']);
  const canAdmin = hasRole(session, ['ADMIN']);

  const showError = (error: unknown) => setMessage(getErrorMessage(error));

  const handleList = async () => {
    if (!canRead) return;
    setMessage('');
    try {
      const response = await deliveriesApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        projectId: query.projectId || undefined,
        authorId: query.authorId || undefined,
        status: (query.status || undefined) as DeliveryStatus | undefined,
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
      const response = await deliveriesApi.detail(targetId);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canCreate) return;
    setMessage('');
    try {
      const response = await deliveriesApi.create({
        projectId: createForm.projectId,
        version: Number(createForm.version),
        status: createForm.status,
        notes: createForm.notes || undefined,
      });
      setResult(response);
      setMessage('Entrega creada correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !updateForm.id.trim()) return;
    setMessage('');
    const payload: Record<string, number | string> = {};
    if (updateForm.version.trim()) payload.version = Number(updateForm.version);
    if (updateForm.status) payload.status = updateForm.status;
    if (updateForm.notes.trim()) payload.notes = updateForm.notes.trim();

    try {
      const response = await deliveriesApi.update(updateForm.id.trim(), payload);
      setResult(response);
      setMessage('Entrega actualizada correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !statusForm.id.trim()) return;
    setMessage('');
    try {
      const response = await deliveriesApi.updateStatus(
        statusForm.id.trim(),
        statusForm.status,
      );
      setResult(response);
      setMessage('Estado de entrega actualizado.');
    } catch (error) {
      showError(error);
    }
  };

  const handleRestore = async () => {
    if (!canAdmin || !restoreId.trim()) return;
    setMessage('');
    try {
      const response = await deliveriesApi.restore(restoreId.trim());
      setResult(response);
      setMessage('Entrega restaurada.');
    } catch (error) {
      showError(error);
    }
  };

  const openDeleteConfirm = (id: string) => {
    if (!canWrite || !id.trim()) return;
    setDeleteId(id.trim());
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!canWrite || !deleteId.trim()) return;
    try {
      await deliveriesApi.remove(deleteId.trim());
      setResult({ message: `Entrega ${deleteId.trim()} eliminada (soft).` });
      setMessage('Entrega eliminada lógicamente.');
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <h2>Deliveries</h2>
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
            Project ID
            <input
              value={query.projectId}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, projectId: event.target.value }))
              }
            />
          </label>
          <label>
            Author ID
            <input
              value={query.authorId}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, authorId: event.target.value }))
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
              {DELIVERY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row gap-8">
          <button className="btn" onClick={handleList} disabled={!canRead}>
            Cargar entregas
          </button>
        </div>

        {listResponse ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Project</th>
                  <th>Author</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listResponse.data.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>{delivery.id}</td>
                    <td>{delivery.projectId}</td>
                    <td>{delivery.authorId}</td>
                    <td>{delivery.version}</td>
                    <td>{delivery.status}</td>
                    <td>
                      <div className="row gap-8">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setDetailId(delivery.id);
                            void handleDetail(delivery.id);
                          }}
                        >
                          Detail
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canWrite}
                          onClick={() => openDeleteConfirm(delivery.id)}
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
            placeholder="delivery uuid"
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
              Project ID
              <input
                required
                value={createForm.projectId}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    projectId: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Version
              <input
                required
                value={createForm.version}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, version: event.target.value }))
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
              Notes
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

        <article className="card">
          <h3>Actualizar</h3>
          <form className="form" onSubmit={handleUpdate}>
            <label>
              Delivery ID
              <input
                required
                value={updateForm.id}
                onChange={(event) =>
                  setUpdateForm((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label>
              Version
              <input
                value={updateForm.version}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    version: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Status
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
              Notes
              <textarea
                value={updateForm.notes}
                onChange={(event) =>
                  setUpdateForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>
            <button className="btn" type="submit" disabled={!canWrite}>
              Actualizar entrega
            </button>
          </form>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h3>Cambio de estado</h3>
          <form className="form" onSubmit={handleStatusUpdate}>
            <label>
              Delivery ID
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
              Restaurar entrega
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
              disabled={!canWrite}
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
        title="Confirmar eliminación de entrega"
        description={`Se eliminará lógicamente la entrega ${deleteId}.`}
        confirmWord="DELETE"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDelete}
      />
    </section>
  );
}
