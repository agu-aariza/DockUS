import { type FormEvent, useState, useEffect } from 'react';
import { 
  storageApi, 
  projectsApi, 
  deliveriesApi, 
  assignmentsApi, 
  builderApi 
} from '../../shared/api/services';
import type { DownloadUrlResponse, StorageObjectEntity } from "../../features/storage/types";
import type { PaginatedResponse } from "../../shared/types";
import type { DeliveryEntity } from "../../features/deliveries/types";
import type { BuildRunEntity } from "../../features/builder/types";
import { useSession } from '../../shared/session/SessionContext';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';
import { computeSha256Hex } from '../../shared/utils/hash';

interface UnifiedStorageItem {
  id: string;
  logicalName: string;
  sizeBytes: number;
  createdAt: string;
  contentType: string;
  itemType: 'storage_object' | 'run_artifact';
  projectName?: string;
  deliveryVersion?: number;
  studentName?: string;
  runId?: string;
  artifactType?: string;
  deliveryId?: string | null;
  projectId?: string | null;
}

type DangerAction = 'DELETE' | 'PURGE';
type StorageSortBy = 'createdAt' | 'updatedAt' | 'logicalName' | 'sizeBytes';
type SortOrder = 'ASC' | 'DESC';

export function useStorageManagement() {
  const { activeSession: session } = useSession();
  const [query, setQuery] = useState({
    page: '1',
    limit: '20',
    projectId: '',
    deliveryId: '',
    runId: '',
    uploaderId: '',
    createdFrom: '',
    createdTo: '',
    sortBy: 'createdAt' as StorageSortBy,
    sortOrder: 'DESC' as SortOrder,
  });
  const [listResponse, setListResponse] = useState<PaginatedResponse<StorageObjectEntity> | null>(null);
  const [unifiedItems, setUnifiedItems] = useState<UnifiedStorageItem[]>([]);
  const [projectsList, setProjectsList] = useState<Array<{ id: string; title: string }>>([]);
  const [deliveriesList, setDeliveriesList] = useState<DeliveryEntity[]>([]);
  const [runsList, setRunsList] = useState<BuildRunEntity[]>([]);

  // Preview States
  const [previewContent, setPreviewContent] = useState<Array<{ path: string; content: string }> | string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Download loading
  const [downloadLoading, setDownloadLoading] = useState(false);

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

  // 1. Fetch Projects list based on Role
  useEffect(() => {
    if (!canRead) return;
    const fetchProjects = async () => {
      try {
        if (canTeacherOrAdmin) {
          const res = await projectsApi.list({ limit: 100 });
          setProjectsList(res.data.map(p => ({ id: p.id, title: p.title })));
        } else {
          const res = await assignmentsApi.listMine();
          setProjectsList(res.map(a => ({ id: a.projectId, title: a.projectTitle })));
        }
      } catch (e) {
        console.error('Error fetching projects for filters:', e);
      }
    };
    void fetchProjects();
  }, [canRead, canTeacherOrAdmin]);

  // 2. Fetch Deliveries list when selected project changes
  useEffect(() => {
    if (!query.projectId) {
      setDeliveriesList([]);
      setRunsList([]);
      setQuery(prev => ({ ...prev, deliveryId: '', runId: '' }));
      return;
    }
    const fetchDeliveries = async () => {
      try {
        const res = await deliveriesApi.list({ projectId: query.projectId, limit: 100 });
        setDeliveriesList(res.data);
        setRunsList([]);
        setQuery(prev => ({ ...prev, deliveryId: '', runId: '' }));
      } catch (e) {
        console.error('Error fetching deliveries for filters:', e);
      }
    };
    void fetchDeliveries();
  }, [query.projectId]);

  // 3. Fetch Runs list when selected delivery changes
  useEffect(() => {
    if (!query.deliveryId) {
      setRunsList([]);
      setQuery(prev => ({ ...prev, runId: '' }));
      return;
    }
    const fetchRuns = async () => {
      try {
        const res = await builderApi.listByDelivery({ deliveryId: query.deliveryId, limit: 100 });
        setRunsList(res.data);
        setQuery(prev => ({ ...prev, runId: '' }));
      } catch (e) {
        console.error('Error fetching runs for filters:', e);
      }
    };
    void fetchRuns();
  }, [query.deliveryId]);

  const handleList = async () => {
    if (!canRead) return;
    try {
      const response = await storageApi.list({
        page: Number(query.page) || 1,
        limit: Number(query.limit) || 20,
        deliveryId: query.deliveryId || undefined,
        projectId: query.projectId || undefined,
        uploaderId: query.uploaderId || undefined,
        createdFrom: query.createdFrom || undefined,
        createdTo: query.createdTo || undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });
      setListResponse(response);
      setResult(response);

      if (query.runId) {
        try {
          const artifacts = await builderApi.listEvidenceArtifacts(query.runId);
          
          const sourceObjects = response.data.map(item => ({
            id: item.id,
            logicalName: item.logicalName,
            sizeBytes: item.sizeBytes,
            createdAt: item.createdAt,
            contentType: item.contentType,
            itemType: 'storage_object' as const,
            projectName: item.projectName,
            deliveryVersion: item.deliveryVersion,
            studentName: item.studentName,
            deliveryId: item.deliveryId,
            projectId: item.projectId,
          }));

          const runArtifacts = artifacts.map(art => ({
            id: art.id,
            logicalName: `${art.type.toLowerCase().replace(/_/g, ' ')}`,
            sizeBytes: art.sizeBytes,
            createdAt: art.createdAt,
            contentType: art.contentType,
            itemType: 'run_artifact' as const,
            runId: query.runId,
            artifactType: art.type,
            projectName: response.data[0]?.projectName || projectsList.find(p => p.id === query.projectId)?.title,
            deliveryVersion: response.data[0]?.deliveryVersion || deliveriesList.find(d => d.id === query.deliveryId)?.version,
            studentName: response.data[0]?.studentName,
            deliveryId: query.deliveryId,
            projectId: query.projectId,
          }));

          setUnifiedItems([...sourceObjects, ...runArtifacts]);
        } catch (err) {
          console.error('Error fetching run artifacts:', err);
          const sourceObjects = response.data.map(item => ({
            id: item.id,
            logicalName: item.logicalName,
            sizeBytes: item.sizeBytes,
            createdAt: item.createdAt,
            contentType: item.contentType,
            itemType: 'storage_object' as const,
            projectName: item.projectName,
            deliveryVersion: item.deliveryVersion,
            studentName: item.studentName,
            deliveryId: item.deliveryId,
            projectId: item.projectId,
          }));
          setUnifiedItems(sourceObjects);
        }
      } else {
        const sourceObjects = response.data.map(item => ({
          id: item.id,
          logicalName: item.logicalName,
          sizeBytes: item.sizeBytes,
          createdAt: item.createdAt,
          contentType: item.contentType,
          itemType: 'storage_object' as const,
          projectName: item.projectName,
          deliveryVersion: item.deliveryVersion,
          studentName: item.studentName,
          deliveryId: item.deliveryId,
          projectId: item.projectId,
        }));
        setUnifiedItems(sourceObjects);
      }
    } catch (e) { setMessage(getErrorMessage(e)); }
  };

  const handlePreview = async (item: UnifiedStorageItem) => {
    setPreviewLoading(true);
    setPreviewTitle(item.logicalName);
    setPreviewContent(null);
    try {
      if (item.itemType === 'storage_object') {
        if (item.logicalName.endsWith('.zip') || item.contentType === 'application/zip') {
          let res;
          if (item.deliveryId) {
            res = await deliveriesApi.preview(item.deliveryId);
          } else if (item.projectId) {
            res = await projectsApi.previewTestSuite(item.projectId);
          } else {
            res = await deliveriesApi.preview(item.id);
          }
          setPreviewContent(res);
        } else {
          setPreviewContent('Vista previa no disponible para este tipo de archivo. Por favor descarga el archivo.');
        }
      } else if (item.itemType === 'run_artifact' && item.runId) {
        const content = await builderApi.getEvidenceContent(item.runId, item.id);
        setPreviewContent(content);
      }
    } catch (e) {
      setPreviewContent(`Error al cargar la vista previa: ${getErrorMessage(e)}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadItem = async (item: UnifiedStorageItem) => {
    setDownloadLoading(true);
    try {
      let downloadUrl = '';
      if (item.itemType === 'storage_object') {
        const res = await storageApi.createDownloadUrl(item.id);
        downloadUrl = res.downloadUrl;
      } else if (item.itemType === 'run_artifact' && item.runId) {
        const res = await builderApi.getEvidenceDownloadUrl(item.runId, item.id);
        downloadUrl = res.downloadUrl;
      }
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      } else {
        setMessage('No se pudo generar la URL de descarga.');
      }
    } catch (e) {
      setMessage(`Error al descargar: ${getErrorMessage(e)}`);
    } finally {
      setDownloadLoading(false);
    }
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
    unifiedItems,
    projectsList,
    deliveriesList,
    runsList,
    previewContent, setPreviewContent,
    previewTitle, setPreviewTitle,
    previewLoading,
    downloadLoading,
    handlePreview,
    handleDownloadItem,
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
