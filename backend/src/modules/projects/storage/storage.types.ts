import type { PaginationMeta } from '../../../shared/utils/pagination.util';
import type { StorageObjectResponse } from '@dockus/contracts';

/**
 * Shapes compartidas con el frontend. La fuente única de verdad vive en
 * `@dockus/contracts`; `CreateDownloadUrlResponse` es el nombre local del
 * `DownloadUrlResponse` del contrato.
 */
export type {
  StorageObjectResponse,
  DownloadUrlResponse as CreateDownloadUrlResponse,
} from '@dockus/contracts';

export type StorageObjectsPaginationMeta = PaginationMeta;

export interface PaginatedStorageResponse {
  data: StorageObjectResponse[];
  meta: StorageObjectsPaginationMeta;
}
