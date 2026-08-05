/**
 * @fileoverview Puerto de almacenamiento de objetos (object-storage.port).
 *
 * @module object-storage.port
 */

import type { Readable } from 'stream';

/**
 * Contrato de almacenamiento de objetos utilizado por proyectos, entregas y
 * Builder. Define operaciones de lectura, escritura, borrado y generación de
 * URLs sin exponer el cliente de MinIO ni sus hooks de inicialización.
 */
export interface IObjectStorage {
  getBucketName(): string;

  getSignedUrlTtlSeconds(): number;

  putObject(params: {
    bucket: string;
    key: string;
    body: Buffer | Readable;
    contentType: string;
    /** Obligatorio si `body` es un `Readable` — ver el comentario en `minio-storage.service.ts`. */
    contentLength?: number;
  }): Promise<void>;

  deleteObject(bucket: string, key: string): Promise<void>;

  objectExists(bucket: string, key: string): Promise<boolean>;

  createDownloadSignedUrl(bucket: string, key: string): Promise<string>;

  getObjectBuffer(bucket: string, key: string): Promise<Buffer>;
}

export const OBJECT_STORAGE = Symbol('IObjectStorage');
