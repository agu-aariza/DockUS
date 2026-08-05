/**
 * @fileoverview Módulo de proyectos académicos y entregas (storage.types).
 *
 * @module storage.types
 */

import type { PaginationMeta } from '../../../shared/utils/pagination.util';
import type { StorageObjectResponse } from '@educodeai/contracts';

/**
 * Shapes compartidas con el frontend. La fuente única de verdad vive en
 * `@educodeai/contracts`; `CreateDownloadUrlResponse` es el nombre local del
 * `DownloadUrlResponse` del contrato.
 */
export type {
  StorageObjectResponse,
  DownloadUrlResponse as CreateDownloadUrlResponse,
} from '@educodeai/contracts';

export type StorageObjectsPaginationMeta = PaginationMeta;

export interface PaginatedStorageResponse {
  data: StorageObjectResponse[];
  meta: StorageObjectsPaginationMeta;
}
