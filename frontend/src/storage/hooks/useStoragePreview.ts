import { useState } from "react";
import { storageApi } from "../api/storageApi";
import { projectsApi } from "../../projects/api/projectsApi";
import { deliveriesApi } from "../../deliveries/api/deliveriesApi";
import { builderApi } from "../../builder/api/builderApi";
import { getErrorMessage } from "../../shared/utils/errors";
import type { PreviewContent, UnifiedStorageItem } from "./storageManagement.types";

export function useStoragePreview() {
  const [previewContent, setPreviewContent] = useState<PreviewContent>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async (item: UnifiedStorageItem) => {
    setPreviewLoading(true);
    setPreviewTitle(item.logicalName);
    setPreviewContent(null);
    try {
      if (item.itemType === "storage_object") {
        if (item.logicalName.endsWith(".zip") || item.contentType === "application/zip") {
          let response;
          if (item.deliveryId) {
            response = await deliveriesApi.preview(item.deliveryId);
          } else if (item.projectId) {
            response = await projectsApi.previewTestSuite(item.projectId);
          } else {
            response = await deliveriesApi.preview(item.id);
          }
          setPreviewContent(response);
        } else {
          setPreviewContent("Vista previa no disponible para este tipo de archivo. Por favor descarga el archivo.");
        }
      } else if (item.itemType === "run_artifact" && item.runId) {
        const content = await builderApi.getEvidenceContent(item.runId, item.id);
        setPreviewContent(content);
      }
    } catch (error) {
      setPreviewContent(`Error al cargar la vista previa: ${getErrorMessage(error)}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  return {
    previewContent,
    setPreviewContent,
    previewTitle,
    setPreviewTitle,
    previewLoading,
    handlePreview,
  };
}
