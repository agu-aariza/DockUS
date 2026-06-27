export type StorageAssetRole = "STUDENT_SOURCE" | "TEACHER_TESTS";

export interface StorageObjectEntity {
  id: string;
  assetRole: StorageAssetRole;
  projectId: string | null;
  deliveryId: string | null;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  createdAt: string;
  uploaderId: string;
  projectName?: string;
  deliveryVersion?: number;
  studentName?: string;
}

export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}
