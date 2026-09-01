import { useState } from "react";
import { storageApi } from "../api/storageApi";
import { builderApi } from "../../builder/api/builderApi";
import { getErrorMessage } from "../../shared/utils/errors";
import type { UnifiedStorageItem } from "./storageManagement.types";

interface StorageDownloadsInput {
  setMessage: (message: string) => void;
}

export function useStorageDownloads({ setMessage }: StorageDownloadsInput) {
  const [downloadLoading, setDownloadLoading] = useState(false);

  const handleDownloadItem = async (item: UnifiedStorageItem) => {
    setDownloadLoading(true);
    try {
      let downloadUrl = "";
      if (item.itemType === "storage_object") {
        const response = await storageApi.createDownloadUrl(item.id);
        downloadUrl = response.downloadUrl;
      } else if (item.itemType === "run_artifact" && item.runId) {
        const response = await builderApi.getEvidenceDownloadUrl(item.runId, item.id);
        downloadUrl = response.downloadUrl;
      }
      if (downloadUrl) {
        window.open(downloadUrl, "_blank");
      } else {
        setMessage("No se pudo generar la URL de descarga.");
      }
    } catch (error) {
      setMessage(`Error al descargar: ${getErrorMessage(error)}`);
    } finally {
      setDownloadLoading(false);
    }
  };

  return { downloadLoading, handleDownloadItem };
}
