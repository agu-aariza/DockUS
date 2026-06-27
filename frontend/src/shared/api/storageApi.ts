import { http } from "./http";
import { toParams } from "./query-params";
import type { DownloadUrlResponse, StorageAssetRole, StorageObjectEntity } from "../../features/storage/types";
import type { PaginatedResponse } from "../types";

export const storageApi = {
  async list(query: {
    page?: number;
    limit?: number;
    deliveryId?: string;
    projectId?: string;
    assetRole?: StorageAssetRole;
    uploaderId?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortOrder?: "ASC" | "DESC";
  }): Promise<PaginatedResponse<StorageObjectEntity>> {
    const { data } = await http.get<PaginatedResponse<StorageObjectEntity>>(
      "/storage",
      { params: toParams(query) },
    );
    return data;
  },

  async detail(id: string): Promise<StorageObjectEntity> {
    const { data } = await http.get<StorageObjectEntity>(`/storage/${id}`);
    return data;
  },

  async upload(input: {
    deliveryId: string;
    logicalName: string;
    logicalPath: string;
    contentType: string;
    hash: string;
    file: File;
    sizeBytes?: number;
  }): Promise<StorageObjectEntity> {
    const formData = new FormData();
    formData.append("deliveryId", input.deliveryId);
    formData.append("logicalName", input.logicalName);
    formData.append("logicalPath", input.logicalPath);
    formData.append("contentType", input.contentType);
    formData.append("hash", input.hash);
    if (typeof input.sizeBytes === "number") {
      formData.append("sizeBytes", String(input.sizeBytes));
    }
    formData.append("file", input.file);

    const { data } = await http.post<StorageObjectEntity>(
      "/storage/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return data;
  },

  async createDownloadUrl(id: string): Promise<DownloadUrlResponse> {
    const { data } = await http.post<DownloadUrlResponse>(
      `/storage/${id}/download-url`,
    );
    return data;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/storage/${id}`);
  },

  async purge(id: string): Promise<void> {
    await http.delete(`/storage/${id}/purge`);
  },

  async restore(id: string): Promise<StorageObjectEntity> {
    const { data } = await http.patch<StorageObjectEntity>(
      `/storage/${id}/restore`,
    );
    return data;
  },
};
