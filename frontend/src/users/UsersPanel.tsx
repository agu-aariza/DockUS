import { type FormEvent, useState } from 'react';
import { usersApi } from '../shared/api/services';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import type {
  PaginatedResponse,
  SessionRecord,
  UserEntity,
  UserRole,
  UserStatus,
} from '../shared/types';
import { getErrorMessage } from '../shared/utils/errors';
import { hasRole } from '../shared/utils/permissions';

interface UsersPanelProps {
  session: SessionRecord | null;
}

const USER_ROLES: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT'];
const USER_STATUSES: UserStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'PENDING_VERIFICATION',
];

export function UsersPanel({ session }: UsersPanelProps): JSX.Element {
  const [query, setQuery] = useState({
    page: '1',
    limit: '20',
    role: '',
    status: '',
    search: '',
  });
  const [listResponse, setListResponse] =
    useState<PaginatedResponse<UserEntity> | null>(null);
  const [detailId, setDetailId] = useState('');
  const [createForm, setCreateForm] = useState({
    email: '',
    password: 'Password123!',
    firstName: '',
    lastName: '',
    role: 'STUDENT' as UserRole,
    status: 'ACTIVE' as UserStatus,
  });
  const [updateForm, setUpdateForm] = useState({
    id: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: '',
    status: '',
  });
  const [statusForm, setStatusForm] = useState({
    id: '',
    status: 'ACTIVE' as UserStatus,
  });
  const [restoreId, setRestoreId] = useState('');
  const [deleteId, setDeleteId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const canList = hasRole(session, ['ADMIN', 'TEACHER']);
  const canAdmin = hasRole(session, ['ADMIN']);

  const showError = (error: unknown) => setMessage(getErrorMessage(error));

  const handleList = async () => {
    if (!canList) return;
    setMessage('');
    try {
      const response = await usersApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        role: (query.role || undefined) as UserRole | undefined,
        status: (query.status || undefined) as UserStatus | undefined,
        search: query.search || undefined,
      });
      setListResponse(response);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleDetail = async (inputId?: string) => {
    const targetId = (inputId ?? detailId).trim();
    if (!canList || !targetId) return;
    setMessage('');
    try {
      const response = await usersApi.detail(targetId);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin) return;
    setMessage('');
    try {
      const response = await usersApi.create({
        email: createForm.email,
        password: createForm.password,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        role: createForm.role,
        status: createForm.status,
      });
      setResult(response);
      setMessage('Usuario creado correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin || !updateForm.id.trim()) return;
    setMessage('');
    const payload: Record<string, string> = {};
    if (updateForm.email.trim()) payload.email = updateForm.email.trim();
    if (updateForm.password.trim()) payload.password = updateForm.password.trim();
    if (updateForm.firstName.trim()) payload.firstName = updateForm.firstName.trim();
    if (updateForm.lastName.trim()) payload.lastName = updateForm.lastName.trim();
    if (updateForm.role) payload.role = updateForm.role;
    if (updateForm.status) payload.status = updateForm.status;

    try {
      const response = await usersApi.update(updateForm.id.trim(), payload);
      setResult(response);
      setMessage('Usuario actualizado correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleStatusUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAdmin || !statusForm.id.trim()) return;
    setMessage('');
    try {
      const response = await usersApi.updateStatus(
        statusForm.id.trim(),
        statusForm.status,
      );
      setResult(response);
      setMessage('Estado de usuario actualizado.');
    } catch (error) {
      showError(error);
    }
  };

  const handleRestore = async () => {
    if (!canAdmin || !restoreId.trim()) return;
    setMessage('');
    try {
      const response = await usersApi.restore(restoreId.trim());
      setResult(response);
      setMessage('Usuario restaurado.');
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
      await usersApi.remove(deleteId.trim());
      setResult({ message: `Usuario ${deleteId.trim()} eliminado (soft delete).` });
      setMessage('Usuario eliminado lógicamente.');
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <h2>Users</h2>
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
            Role
            <select
              value={query.role}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, role: event.target.value }))
              }
            >
              <option value="">--</option>
              {USER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
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
              {USER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Search
          <input
            value={query.search}
            onChange={(event) =>
              setQuery((prev) => ({ ...prev, search: event.target.value }))
            }
          />
        </label>
        <div className="row gap-8">
          <button className="btn" onClick={handleList} disabled={!canList}>
            Cargar usuarios
          </button>
          <span className="hint">
            {canList ? 'Permitido' : 'Solo ADMIN/TEACHER'}
          </span>
        </div>

        {listResponse ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listResponse.data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>
                      <div className="row gap-8">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setDetailId(user.id);
                            void handleDetail(user.id);
                          }}
                        >
                          Detail
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canAdmin}
                          onClick={() => openDeleteConfirm(user.id)}
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
            placeholder="user uuid"
          />
          <button
            className="btn"
            onClick={() => {
              void handleDetail();
            }}
            disabled={!canList}
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
              Email
              <input
                type="email"
                required
                value={createForm.email}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </label>
            <label>
              Password
              <input
                required
                value={createForm.password}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              First name
              <input
                required
                value={createForm.firstName}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    firstName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Last name
              <input
                required
                value={createForm.lastName}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    lastName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Role
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    role: event.target.value as UserRole,
                  }))
                }
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    status: event.target.value as UserStatus,
                  }))
                }
              >
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={!canAdmin}>
              Crear usuario
            </button>
          </form>
        </article>

        <article className="card">
          <h3>Actualizar</h3>
          <form className="form" onSubmit={handleUpdate}>
            <label>
              User ID
              <input
                required
                value={updateForm.id}
                onChange={(event) =>
                  setUpdateForm((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label>
              Email
              <input
                value={updateForm.email}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Password
              <input
                value={updateForm.password}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              First name
              <input
                value={updateForm.firstName}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    firstName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Last name
              <input
                value={updateForm.lastName}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    lastName: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Role (optional)
              <select
                value={updateForm.role}
                onChange={(event) =>
                  setUpdateForm((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }))
                }
              >
                <option value="">--</option>
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
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
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={!canAdmin}>
              Actualizar usuario
            </button>
          </form>
        </article>
      </section>

      <section className="grid two-col">
        <article className="card">
          <h3>Cambio de estado</h3>
          <form className="form" onSubmit={handleStatusUpdate}>
            <label>
              User ID
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
                    status: event.target.value as UserStatus,
                  }))
                }
              >
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn" type="submit" disabled={!canAdmin}>
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
              Restaurar usuario
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
        title="Confirmar eliminación de usuario"
        description={`Se eliminará lógicamente el usuario ${deleteId}.`}
        confirmWord="DELETE"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDelete}
      />
    </section>
  );
}
