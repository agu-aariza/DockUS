import type { DownloadUrlResponse } from "../../features/storage/types";
import { storageApi } from "../api/storageApi";

export interface UnifiedStorageItem {
  id: string;
  logicalName: string;
  sizeBytes: number;
  createdAt: string;
  contentType: string;
  itemType: "storage_object" | "run_artifact";
  projectName?: string;
  deliveryVersion?: number;
  studentName?: string;
  runId?: string;
  artifactType?: string;
  deliveryId?: string | null;
  projectId?: string | null;
}

export type DangerAction = "DELETE" | "PURGE";
export type StorageSortBy = "createdAt" | "updatedAt" | "logicalName" | "sizeBytes";
export type SortOrder = "ASC" | "DESC";
export type StorageListQuery = Parameters<typeof storageApi.list>[0];
export type PreviewContent = Array<{ path: string; content: string }> | string | null;
export type StorageDownloadResult = DownloadUrlResponse;

export interface StorageFilterQuery {
  page: string;
  limit: string;
  projectId: string;
  deliveryId: string;
  runId: string;
  uploaderId: string;
  createdFrom: string;
  createdTo: string;
  sortBy: StorageSortBy;
  sortOrder: SortOrder;
}

export interface StorageUploadForm {
  deliveryId: string;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  includeSizeBytes: boolean;
}

export type StorageListResponse = Awaited<ReturnType<typeof storageApi.list>>;
