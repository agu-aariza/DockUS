import { type FormEvent, useState } from 'react';
import { storageApi } from '../shared/api/services';
import { DangerConfirmModal } from '../shared/components/DangerConfirmModal';
import { JsonResult } from '../shared/components/JsonResult';
import type {
  DownloadUrlResponse,
  PaginatedResponse,
  SessionRecord,
  StorageObjectEntity,
} from '../shared/types';
import { getErrorMessage } from '../shared/utils/errors';
import { hasRole } from '../shared/utils/permissions';
import { computeSha256Hex } from '../shared/utils/hash';

interface StoragePanelProps {
  session: SessionRecord | null;
}

type DangerAction = 'DELETE' | 'PURGE';
type StorageSortBy = 'createdAt' | 'updatedAt' | 'logicalName' | 'sizeBytes';
type SortOrder = 'ASC' | 'DESC';

export function StoragePanel({ session }: StoragePanelProps): JSX.Element {
  const [query, setQuery] = useState({
    page: '1',
    limit: '20',
    deliveryId: '',
    uploaderId: '',
    createdFrom: '',
    createdTo: '',
    sortBy: 'createdAt' as StorageSortBy,
    sortOrder: 'DESC' as SortOrder,
  });
  const [listResponse, setListResponse] =
    useState<PaginatedResponse<StorageObjectEntity> | null>(null);
  const [detailId, setDetailId] = useState('');
  const [uploadForm, setUploadForm] = useState({
    deliveryId: '',
    logicalName: '',
    logicalPath: '',
    contentType: 'application/octet-stream',
    hash: '',
    includeSizeBytes: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [downloadId, setDownloadId] = useState('');
  const [downloadResult, setDownloadResult] =
    useState<DownloadUrlResponse | null>(null);
  const [restoreId, setRestoreId] = useState('');
  const [actionId, setActionId] = useState('');
  const [dangerAction, setDangerAction] = useState<DangerAction>('DELETE');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');
  const [hashLoading, setHashLoading] = useState(false);

  const canRead = Boolean(session);
  const canUpload = Boolean(session);
  const canSoftDelete = hasRole(session, ['ADMIN', 'TEACHER']);
  const canAdmin = hasRole(session, ['ADMIN']);

  const showError = (error: unknown) => setMessage(getErrorMessage(error));

  const handleList = async () => {
    if (!canRead) return;
    setMessage('');
    try {
      const response = await storageApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        deliveryId: query.deliveryId || undefined,
        uploaderId: query.uploaderId || undefined,
        createdFrom: query.createdFrom || undefined,
        createdTo: query.createdTo || undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
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
      const response = await storageApi.detail(targetId);
      setResult(response);
    } catch (error) {
      showError(error);
    }
  };

  const handleFileChange = (nextFile: File | null) => {
    setFile(nextFile);
    if (!nextFile) return;

    setUploadForm((prev) => ({
      ...prev,
      logicalName: prev.logicalName || nextFile.name,
      logicalPath: prev.logicalPath || `src/${nextFile.name}`,
      contentType: nextFile.type || prev.contentType || 'application/octet-stream',
    }));
  };

  const handleComputeHash = async () => {
    if (!file) return;
    setHashLoading(true);
    try {
      const hash = await computeSha256Hex(file);
      setUploadForm((prev) => ({ ...prev, hash }));
      setMessage('Hash SHA-256 calculado automáticamente.');
    } catch {
      setMessage('No se pudo calcular el hash del archivo.');
    } finally {
      setHashLoading(false);
    }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpload || !file) return;
    setMessage('');
    try {
      const response = await storageApi.upload({
        deliveryId: uploadForm.deliveryId,
        logicalName: uploadForm.logicalName,
        logicalPath: uploadForm.logicalPath,
        contentType: uploadForm.contentType,
        hash: uploadForm.hash,
        file,
        sizeBytes: uploadForm.includeSizeBytes ? file.size : undefined,
      });
      setResult(response);
      setMessage('Objeto subido correctamente a storage.');
    } catch (error) {
      showError(error);
    }
  };

  const handleDownloadUrl = async (inputId?: string) => {
    const targetId = (inputId ?? downloadId).trim();
    if (!canRead || !targetId) return;
    setMessage('');
    try {
      const response = await storageApi.createDownloadUrl(targetId);
      setDownloadResult(response);
      setResult(response);
      setMessage('Signed URL generada correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const handleRestore = async () => {
    if (!canAdmin || !restoreId.trim()) return;
    setMessage('');
    try {
      const response = await storageApi.restore(restoreId.trim());
      setResult(response);
      setMessage('Objeto restaurado correctamente.');
    } catch (error) {
      showError(error);
    }
  };

  const openDanger = (id: string, action: DangerAction) => {
    if (!id.trim()) return;
    if (action === 'DELETE' && !canSoftDelete) return;
    if (action === 'PURGE' && !canAdmin) return;
    setActionId(id.trim());
    setDangerAction(action);
    setConfirmOpen(true);
  };

  const executeDanger = async () => {
    if (!actionId.trim()) return;

    try {
      if (dangerAction === 'DELETE') {
        await storageApi.remove(actionId.trim());
        setResult({ message: `Storage ${actionId.trim()} eliminado (soft).` });
        setMessage('Objeto marcado como eliminado.');
      } else {
        await storageApi.purge(actionId.trim());
        setResult({ message: `Storage ${actionId.trim()} purgado físicamente.` });
        setMessage('Objeto purgado físicamente.');
      }
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  return (
    <section className="stack">
      <header className="panel-header">
        <h2>Storage</h2>
        <p>
          Rol activo: <strong>{session?.role ?? 'Sin sesión'}</strong>
        </p>
      </header>

      <article className="card">
        <h3>Upload multipart</h3>
        <form className="form" onSubmit={handleUpload}>
          <label>
            Delivery ID
            <input
              required
              value={uploadForm.deliveryId}
              onChange={(event) =>
                setUploadForm((prev) => ({
                  ...prev,
                  deliveryId: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Logical name
            <input
              required
              value={uploadForm.logicalName}
              onChange={(event) =>
                setUploadForm((prev) => ({
                  ...prev,
                  logicalName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Logical path
            <input
              required
              value={uploadForm.logicalPath}
              onChange={(event) =>
                setUploadForm((prev) => ({
                  ...prev,
                  logicalPath: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Content type
            <input
              required
              value={uploadForm.contentType}
              onChange={(event) =>
                setUploadForm((prev) => ({
                  ...prev,
                  contentType: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Hash
            <input
              required
              value={uploadForm.hash}
              onChange={(event) =>
                setUploadForm((prev) => ({ ...prev, hash: event.target.value }))
              }
            />
          </label>
          <label>
            File
            <input
              type="file"
              required
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
            />
          </label>
          <label className="row gap-8 align-center">
            <input
              type="checkbox"
              checked={uploadForm.includeSizeBytes}
              onChange={(event) =>
                setUploadForm((prev) => ({
                  ...prev,
                  includeSizeBytes: event.target.checked,
                }))
              }
            />
            Enviar `sizeBytes` (opcional)
          </label>
          <div className="row gap-8">
            <button
              type="button"
              className="btn ghost"
              onClick={handleComputeHash}
              disabled={!file || hashLoading}
            >
              {hashLoading ? 'Calculando...' : 'Calcular hash SHA-256'}
            </button>
            <button className="btn" type="submit" disabled={!canUpload || !file}>
              Subir objeto
            </button>
          </div>
        </form>
      </article>

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
            Delivery ID
            <input
              value={query.deliveryId}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, deliveryId: event.target.value }))
              }
            />
          </label>
          <label>
            Uploader ID
            <input
              value={query.uploaderId}
              onChange={(event) =>
                setQuery((prev) => ({ ...prev, uploaderId: event.target.value }))
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
          <label>
            Sort by
            <select
              value={query.sortBy}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  sortBy: event.target.value as StorageSortBy,
                }))
              }
            >
              <option value="createdAt">createdAt</option>
              <option value="updatedAt">updatedAt</option>
              <option value="logicalName">logicalName</option>
              <option value="sizeBytes">sizeBytes</option>
            </select>
          </label>
          <label>
            Sort order
            <select
              value={query.sortOrder}
              onChange={(event) =>
                setQuery((prev) => ({
                  ...prev,
                  sortOrder: event.target.value as SortOrder,
                }))
              }
            >
              <option value="DESC">DESC</option>
              <option value="ASC">ASC</option>
            </select>
          </label>
        </div>
        <button className="btn" onClick={handleList} disabled={!canRead}>
          Cargar objetos
        </button>

        {listResponse ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Delivery</th>
                  <th>Name</th>
                  <th>Path</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {listResponse.data.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td>{item.deliveryId}</td>
                    <td>{item.logicalName}</td>
                    <td>{item.logicalPath}</td>
                    <td>{item.sizeBytes}</td>
                    <td>
                      <div className="row gap-8">
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setDetailId(item.id);
                            void handleDetail(item.id);
                          }}
                        >
                          Detail
                        </button>
                        <button
                          className="btn ghost"
                          onClick={() => {
                            setDownloadId(item.id);
                            void handleDownloadUrl(item.id);
                          }}
                        >
                          URL
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canSoftDelete}
                          onClick={() => openDanger(item.id, 'DELETE')}
                        >
                          Delete
                        </button>
                        <button
                          className="btn danger"
                          disabled={!canAdmin}
                          onClick={() => openDanger(item.id, 'PURGE')}
                        >
                          Purge
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

      <section className="grid two-col">
        <article className="card">
          <h3>Detalle + Download URL</h3>
          <div className="form">
            <label>
              Detail ID
              <input
                value={detailId}
                onChange={(event) => setDetailId(event.target.value)}
                placeholder="storage uuid"
              />
            </label>
            <button
              className="btn"
              onClick={() => {
                void handleDetail();
              }}
              disabled={!canRead}
            >
              Buscar detalle
            </button>
            <label>
              Download URL ID
              <input
                value={downloadId}
                onChange={(event) => setDownloadId(event.target.value)}
                placeholder="storage uuid"
              />
            </label>
            <button
              className="btn"
              onClick={() => {
                void handleDownloadUrl();
              }}
              disabled={!canRead}
            >
              Generar signed URL
            </button>
            {downloadResult ? (
              <div className="message info">
                <p>
                  Expira: <strong>{downloadResult.expiresAt}</strong>
                </p>
                <a href={downloadResult.downloadUrl} target="_blank" rel="noreferrer">
                  Abrir descarga firmada
                </a>
              </div>
            ) : null}
          </div>
        </article>

        <article className="card">
          <h3>Restore / Delete / Purge</h3>
          <div className="form">
            <label>
              Restore ID (ADMIN)
              <input
                value={restoreId}
                onChange={(event) => setRestoreId(event.target.value)}
              />
            </label>
            <button className="btn" onClick={handleRestore} disabled={!canAdmin}>
              Restaurar objeto
            </button>
            <label>
              Delete/Purge ID
              <input
                value={actionId}
                onChange={(event) => setActionId(event.target.value)}
              />
            </label>
            <div className="row gap-8">
              <button
                className="btn danger"
                disabled={!canSoftDelete}
                onClick={() => openDanger(actionId, 'DELETE')}
              >
                Soft delete
              </button>
              <button
                className="btn danger"
                disabled={!canAdmin}
                onClick={() => openDanger(actionId, 'PURGE')}
              >
                Purge físico
              </button>
            </div>
          </div>
        </article>
      </section>

      {message ? <p className="message">{message}</p> : null}
      {result ? <JsonResult title="Resultado" value={result} /> : null}

      <DangerConfirmModal
        open={confirmOpen}
        title={
          dangerAction === 'PURGE'
            ? 'Confirmar purga física'
            : 'Confirmar eliminación lógica'
        }
        description={
          dangerAction === 'PURGE'
            ? `Se purgará físicamente el objeto ${actionId}.`
            : `Se marcará como eliminado el objeto ${actionId}.`
        }
        confirmWord={dangerAction}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={executeDanger}
      />
    </section>
  );
}
