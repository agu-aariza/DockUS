/**
 * @fileoverview Panel de administración de almacenamiento de objetos S3/MinIO (types).
 *
 * @module types
 */

/**
 * Shapes compartidas con el backend: fuente única en `@educodeai/contracts`.
 * `StorageObjectEntity` y `DownloadUrlResponse` son los nombres locales de
 * `StorageObjectResponse` y `DownloadUrlResponse` del contrato.
 */
export type {
  StorageAssetRole,
  StorageObjectResponse as StorageObjectEntity,
  DownloadUrlResponse,
} from "@educodeai/contracts";
