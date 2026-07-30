/**
 * @fileoverview Puerto de almacenamiento de objetos (object-storage.port).
 *
 * @module object-storage.port
 */

import type { Readable } from 'stream';

/**
 * Plan de arquitectura hexagonal, Fase 1 (P1-2, ver
 * ARQ-007). Cubre la superficie pública
 * completa de `MinioStorageService` salvo `onModuleInit` (hook de ciclo de
 * vida, no forma parte del contrato de negocio) — auditado con grep contra
 * los 7 consumidores reales antes de diseñar: entre todos usan los 7 métodos.
 *
 * A diferencia de `IContainerRuntime` (Fase 1, P1-1), aquí se define un tipo
 * propio para `putObject` en vez de reutilizar el `PutObjectParams` de
 * `minio-storage.service.ts`: ese tipo no es un fichero puro de tipos/constantes
 * (vive en el propio fichero de la clase `@Injectable`, con imports del SDK de
 * AWS) y no calificaría para la misma excepción que `llm.types.ts`/
 * `docker.types.ts` en `.dependency-cruiser.cjs`. Al ser solo 5 campos, sobre
 * primitivas de Node (`Buffer`/`Readable`), duplicarlo aquí es más barato que
 * extraer un fichero de tipos nuevo solo para esto.
 *
 * Puertos consumidos desde 3 módulos Nest distintos (`StorageModule`,
 * `ProjectsModule`, `BuilderModule`) — cada uno registra su propio provider
 * `{ provide: OBJECT_STORAGE, useExisting: MinioStorageService }`, ya que los
 * tres importan `StorageInfrastructureModule`.
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
