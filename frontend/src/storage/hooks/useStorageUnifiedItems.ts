import { useState } from "react";
import { builderApi } from "../../builder/api/builderApi";
import type { StorageFilterQuery, StorageListResponse, UnifiedStorageItem } from "./storageManagement.types";

interface StorageUnifiedItemsInput {
  deliveriesList: Array<{ id: string; version: number }>;
  projectsList: Array<{ id: string; title: string }>;
  query: StorageFilterQuery;
}

export function useStorageUnifiedItems({
  deliveriesList,
  projectsList,
  query,
}: StorageUnifiedItemsInput) {
  const [unifiedItems, setUnifiedItems] = useState<UnifiedStorageItem[]>([]);

  const buildUnifiedItems = async (response: StorageListResponse) => {
    const sourceObjects: UnifiedStorageItem[] = response.data.map((item) => ({
      id: item.id,
      logicalName: item.logicalName,
      sizeBytes: item.sizeBytes,
      createdAt: item.createdAt,
      contentType: item.contentType,
      itemType: "storage_object",
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

    try {
      const artifacts = await builderApi.listEvidenceArtifacts(query.runId);
      const runArtifacts: UnifiedStorageItem[] = artifacts.map((artifact) => ({
        id: artifact.id,
        logicalName: artifact.type.toLowerCase().replace(/_/g, " "),
        sizeBytes: artifact.sizeBytes,
        createdAt: artifact.createdAt,
        contentType: artifact.contentType,
        itemType: "run_artifact",
        runId: query.runId,
        artifactType: artifact.type,
        projectName:
          response.data[0]?.projectName ||
          projectsList.find((project) => project.id === query.projectId)?.title,
        deliveryVersion:
          response.data[0]?.deliveryVersion ||
          deliveriesList.find((delivery) => delivery.id === query.deliveryId)?.version,
        studentName: response.data[0]?.studentName,
        deliveryId: query.deliveryId,
        projectId: query.projectId,
      }));
      setUnifiedItems([...sourceObjects, ...runArtifacts]);
    } catch (error) {
      console.error("Error fetching run artifacts:", error);
      setUnifiedItems(sourceObjects);
    }
  };

  return { unifiedItems, buildUnifiedItems };
}
