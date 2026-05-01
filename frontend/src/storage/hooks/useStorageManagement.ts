import { type FormEvent, useState } from 'react';
import { storageApi } from '../../shared/api/services';
import type {
  DownloadUrlResponse,
  PaginatedResponse,
  SessionRecord,
  StorageObjectEntity,
} from '../../shared/types';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';
import { computeSha256Hex } from '../../shared/utils/hash';

export type DangerAction = 'DELETE' | 'PURGE';
export type StorageSortBy = 'createdAt' | 'updatedAt' | 'logicalName' | 'sizeBytes';
export type SortOrder = 'ASC' | 'DESC';

export function useStorageManagement(session: SessionRecord | null) {
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
  const [listResponse, setListResponse] = useState<PaginatedResponse<StorageObjectEntity> | null>(null);
  const [detailId, setDetailId] = useState('');
  const [uploadForm, setUploadForm] = useState({
    deliveryId: '',
    logicalName: '',
    logicalPath: '',
    contentType: 'application/octet-stream',
    includeSizeBytes: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [downloadId, setDownloadId] = useState('');
  const [downloadResult, setDownloadResult] = useState<DownloadUrlResponse | null>(null);
  const [restoreId, setRestoreId] = useState('');
  const [actionId, setActionId] = useState('');
  const [dangerAction, setDangerAction] = useState<DangerAction>('DELETE');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState('');

  const { canRead, canUpload, canTeacherOrAdmin, canAdmin } =
    useManagementPermissions(session);
  const canSoftDelete = canTeacherOrAdmin;

  const handleList = async () => {
    if (!canRead) return;
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
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canUpload || !file) return;
    try {
      const hash = await computeSha256Hex(file);
      const response = await storageApi.upload({
        ...uploadForm,
        hash,
        file,
        sizeBytes: uploadForm.includeSizeBytes ? file.size : undefined,
      });
      setResult(response);
      setMessage('Objeto subido correctamente.');
      await handleList();
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const executeDanger = async () => {
    if (!actionId.trim()) return;
    try {
      if (dangerAction === 'DELETE') await storageApi.remove(actionId.trim());
      else await storageApi.purge(actionId.trim());
      setMessage('Acción completada.');
      await handleList();
    } catch (e) { setMessage(getErrorMessage(e)); throw e; }
  };

  return {
    query, setQuery,
    listResponse,
    detailId, setDetailId,
    uploadForm, setUploadForm,
    file, setFile,
    downloadId, setDownloadId,
    downloadResult, setDownloadResult,
    restoreId, setRestoreId,
    actionId, setActionId,
    dangerAction, setDangerAction,
    confirmOpen, setConfirmOpen,
    result, setMessage, message,
    canRead, canUpload, canSoftDelete, canAdmin,
    handleList, handleUpload, executeDanger,
    handleFileChange: (f: File | null) => {
      setFile(f);
      if (f) setUploadForm(p => ({ ...p, logicalName: p.logicalName || f.name, logicalPath: p.logicalPath || `src/${f.name}`, contentType: f.type || 'application/octet-stream' }));
    }
  };
}
