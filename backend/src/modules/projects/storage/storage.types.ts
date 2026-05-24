import type { PaginationMeta } from '../../../shared/utils/pagination.util';
import type {
  StorageAssetRole,
  StorageScopeType,
} from './entities/storage-object.entity';

export type StorageObjectsPaginationMeta = PaginationMeta;

export interface StorageObjectResponse {
  id: string;
  scopeType: StorageScopeType;
  scopeId: string;
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

export interface CreateDownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

export interface PaginatedStorageResponse {
  data: StorageObjectResponse[];
  meta: StorageObjectsPaginationMeta;
}
