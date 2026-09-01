/**
 * @fileoverview Composición compatible del panel de administración de storage.
 *
 * @module useStorageManagement
 */

import { useState } from "react";
import { useSession } from "../../shared/session/SessionContext";
import { useManagementPermissions } from "../../shared/session/useManagementPermissions";
import { getErrorMessage } from "../../shared/utils/errors";
import { useStorageCommands } from "./useStorageCommands";
import { useStorageDownloads } from "./useStorageDownloads";
import { useStorageFilters } from "./useStorageFilters";
import { buildStorageListQuery } from "./useStorageCommands";
import { useStoragePreview } from "./useStoragePreview";
import { useStorageQueries } from "./useStorageQueries";
import { useStorageUnifiedItems } from "./useStorageUnifiedItems";
import type {
  DangerAction,
  StorageDownloadResult,
  StorageUploadForm,
} from "./storageManagement.types";

export function useStorageManagement() {
  const { activeSession: session } = useSession();
  const { canRead, canUpload, canTeacherOrAdmin, canAdmin } =
    useManagementPermissions(session);
  const canSoftDelete = canTeacherOrAdmin;

  const filters = useStorageFilters({ canRead, canTeacherOrAdmin });
  const storageQueries = useStorageQueries({ canRead });

  const [detailId, setDetailId] = useState("");
  const [uploadForm, setUploadForm] = useState<StorageUploadForm>({
    deliveryId: "",
    logicalName: "",
    logicalPath: "",
    contentType: "application/octet-stream",
    includeSizeBytes: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [downloadId, setDownloadId] = useState("");
  const [downloadResult, setDownloadResult] = useState<StorageDownloadResult | null>(null);
  const [restoreId, setRestoreId] = useState("");
  const [actionId, setActionId] = useState("");
  const [dangerAction, setDangerAction] = useState<DangerAction>("DELETE");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [message, setMessage] = useState("");

  const unified = useStorageUnifiedItems({
    deliveriesList: filters.deliveriesList,
    projectsList: filters.projectsList,
    query: filters.query,
  });

  const handleList = async () => {
    if (!canRead) return;
    try {
      const response = await storageQueries.fetchStorageList(
        buildStorageListQuery(filters.query),
      );
      setResult(response);
      await unified.buildUnifiedItems(response);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  };

  const preview = useStoragePreview();
  const downloads = useStorageDownloads({ setMessage });
  const commands = useStorageCommands({
    actionId,
    canUpload,
    dangerAction,
    file,
    handleList,
    setMessage,
    setResult,
    uploadForm,
  });

  return {
    query: filters.query,
    setQuery: filters.setQuery,
    listResponse: storageQueries.listResponse,
    unifiedItems: unified.unifiedItems,
    projectsList: filters.projectsList,
    deliveriesList: filters.deliveriesList,
    runsList: filters.runsList,
    previewContent: preview.previewContent,
    setPreviewContent: preview.setPreviewContent,
    previewTitle: preview.previewTitle,
    setPreviewTitle: preview.setPreviewTitle,
    previewLoading: preview.previewLoading,
    downloadLoading: downloads.downloadLoading,
    handlePreview: preview.handlePreview,
    handleDownloadItem: downloads.handleDownloadItem,
    detailId,
    setDetailId,
    uploadForm,
    setUploadForm,
    file,
    setFile,
    downloadId,
    setDownloadId,
    downloadResult,
    setDownloadResult,
    restoreId,
    setRestoreId,
    actionId,
    setActionId,
    dangerAction,
    setDangerAction,
    confirmOpen,
    setConfirmOpen,
    result,
    setMessage,
    message,
    canRead,
    canUpload,
    canSoftDelete,
    canAdmin,
    handleList,
    handleUpload: commands.handleUpload,
    executeDanger: commands.executeDanger,
    handleFileChange: (selectedFile: File | null) => {
      setFile(selectedFile);
      if (selectedFile) {
        setUploadForm((previous) => ({
          ...previous,
          logicalName: previous.logicalName || selectedFile.name,
          logicalPath: previous.logicalPath || `src/${selectedFile.name}`,
          contentType: selectedFile.type || "application/octet-stream",
        }));
      }
    },
  };
}
