/**
 * @fileoverview Panel de administración de almacenamiento de objetos S3/MinIO (useStorageManagement).
 *
 * @module useStorageManagement
 */

import { type FormEvent, useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  storageApi,
  projectsApi,
  deliveriesApi,
  assignmentsApi,
  builderApi
} from '../../shared/api/services';
import type { DownloadUrlResponse, StorageObjectEntity } from "../../features/storage/types";
import type { PaginatedResponse } from "../../shared/types";
import { useSession } from '../../shared/session/SessionContext';
import { useManagementPermissions } from '../../shared/session/useManagementPermissions';
import { getErrorMessage } from '../../shared/utils/errors';
import { computeSha256Hex } from '../../shared/utils/hash';
import { queryKeys } from '../../shared/query/queryKeys';

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
type StorageListQuery = Parameters<typeof storageApi.list>[0];

export function useStorageManagement() {
  const { activeSession: session } = useSession();
  const queryClient = useQueryClient();
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
  const [unifiedItems, setUnifiedItems] = useState<UnifiedStorageItem[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState<StorageListQuery | null>(null);

  const [previewContent, setPreviewContent] = useState<Array<{ path: string; content: string }> | string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

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

  // Query pasiva: solo muestra de forma reactiva lo que ya está "enviado"
  // (submittedQuery). No dispara nada por sí sola en el primer render: nada se
  // carga hasta el primer clic explícito en "Consultar" (ver handleList).
  const storageQuery = useQuery({
    queryKey: queryKeys.storage.list(submittedQuery ?? {}),
    queryFn: () => storageApi.list(submittedQuery!),
    enabled: canRead && submittedQuery !== null,
  });
  const listResponse = storageQuery.data ?? null;

  // 1. Proyectos para el filtro, según rol. Key propia (no queryKeys.projects.list()
  // ni queryKeys.assignments.mine() con transformación): aquí se necesita el dato
  // crudo para no pisar la forma que otros hooks esperan bajo esas keys.
  const projectsForFilterQuery = useQuery({
    queryKey: queryKeys.storage.projectsFilter(),
    queryFn: () => projectsApi.list({ limit: 100 }),
    enabled: canRead && canTeacherOrAdmin,
  });
  const myAssignmentsForFilterQuery = useQuery({
    queryKey: queryKeys.assignments.mine(),
    queryFn: () => assignmentsApi.listMine(),
    enabled: canRead && !canTeacherOrAdmin,
  });
  const projectsList = useMemo(() => {
    if (canTeacherOrAdmin) {
      return (projectsForFilterQuery.data?.data ?? []).map(p => ({ id: p.id, title: p.title }));
    }
    return (myAssignmentsForFilterQuery.data ?? []).map(a => ({ id: a.projectId, title: a.projectTitle }));
  }, [canTeacherOrAdmin, projectsForFilterQuery.data, myAssignmentsForFilterQuery.data]);

  useEffect(() => {
    if (projectsForFilterQuery.isError) {
      console.error('Error fetching projects for filters:', projectsForFilterQuery.error);
    }
  }, [projectsForFilterQuery.isError, projectsForFilterQuery.error]);

  useEffect(() => {
    if (myAssignmentsForFilterQuery.isError) {
      console.error('Error fetching projects for filters:', myAssignmentsForFilterQuery.error);
    }
  }, [myAssignmentsForFilterQuery.isError, myAssignmentsForFilterQuery.error]);

  // 2. Entregas del proyecto seleccionado (dropdown barato, auto-refetch al
  // cambiar projectId está bien aquí — a diferencia de la lista principal).
  const deliveriesForFilterQuery = useQuery({
    queryKey: queryKeys.storage.deliveriesFilter(query.projectId),
    queryFn: () => deliveriesApi.list({ projectId: query.projectId, limit: 100 }),
    enabled: canRead && !!query.projectId,
  });
  const deliveriesList = deliveriesForFilterQuery.data?.data ?? [];

  useEffect(() => {
    if (deliveriesForFilterQuery.isError) {
      console.error('Error fetching deliveries for filters:', deliveriesForFilterQuery.error);
    }
  }, [deliveriesForFilterQuery.isError, deliveriesForFilterQuery.error]);

  // Al cambiar de proyecto, la entrega/run seleccionados dejan de ser válidos.
  useEffect(() => {
    setQuery(prev => ({ ...prev, deliveryId: '', runId: '' }));
  }, [query.projectId]);

  // 3. Runs de la entrega seleccionada.
  const runsForFilterQuery = useQuery({
    queryKey: queryKeys.storage.runsFilter(query.deliveryId),
    queryFn: () => builderApi.listByDelivery({ deliveryId: query.deliveryId, limit: 100 }),
    enabled: canRead && !!query.deliveryId,
  });
  const runsList = runsForFilterQuery.data?.data ?? [];

  useEffect(() => {
    if (runsForFilterQuery.isError) {
      console.error('Error fetching runs for filters:', runsForFilterQuery.error);
    }
  }, [runsForFilterQuery.isError, runsForFilterQuery.error]);

  // Al cambiar de entrega, el run seleccionado deja de ser válido.
  useEffect(() => {
    setQuery(prev => ({ ...prev, runId: '' }));
  }, [query.deliveryId]);

  const buildUnifiedItems = (response: PaginatedResponse<StorageObjectEntity>) => {
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

    if (!query.runId) {
      setUnifiedItems(sourceObjects);
      return;
    }

    builderApi.listEvidenceArtifacts(query.runId)
      .then(artifacts => {
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
      })
      .catch(err => {
        console.error('Error fetching run artifacts:', err);
        setUnifiedItems(sourceObjects);
      });
  };

  // Envía los filtros actuales: usa queryClient.fetchQuery (key calculada
  // in-line) en vez de depender del observer de storageQuery, porque un
  // enabled:false + refetch() en el mismo handler operaría contra la key
  // *anterior* (React aún no ha vuelto a renderizar entre el setState y el
  // refetch síncrono de este mismo evento). staleTime:0 garantiza que un clic
  // explícito en "Consultar" siempre golpea la red, igual que antes.
  const handleList = async () => {
    if (!canRead) return;
    const nextQuery: StorageListQuery = {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
      deliveryId: query.deliveryId || undefined,
      projectId: query.projectId || undefined,
      uploaderId: query.uploaderId || undefined,
      createdFrom: query.createdFrom || undefined,
      createdTo: query.createdTo || undefined,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    setSubmittedQuery(nextQuery);
    try {
      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.storage.list(nextQuery),
        queryFn: () => storageApi.list(nextQuery),
        staleTime: 0,
      });
      setResult(response);
      buildUnifiedItems(response);
    } catch (e) {
      setMessage(getErrorMessage(e));
    }
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

  const removeMutation = useMutation({
    mutationFn: (id: string) => storageApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.all }),
  });
  const purgeMutation = useMutation({
    mutationFn: (id: string) => storageApi.purge(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.storage.all }),
  });

  const executeDanger = async () => {
    if (!actionId.trim()) return;
    try {
      if (dangerAction === 'DELETE') {
        await removeMutation.mutateAsync(actionId.trim());
      } else {
        await purgeMutation.mutateAsync(actionId.trim());
      }
      setMessage('Acción completada.');
      await handleList();
    } catch (e) {
      setMessage(getErrorMessage(e));
      throw e;
    }
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
