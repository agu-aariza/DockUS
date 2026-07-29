/**
 * @fileoverview Puerto de persistencia de `StorageObject`
 * (storage-object.repository.interface).
 *
 * @module storage-object.repository.interface
 */

import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import {
  StorageAssetRole,
  StorageObject,
} from '../../storage/entities/storage-object.entity';
import type { StorageSortField } from '../../storage/dto/list-storage-objects-query.dto';
import type { SortOrder } from '../../../../shared/dto/paginated-query.dto';

/**
 * Puerto real (audit/areas/arquitectura/plan_accion.md P2-6): sin puerto
 * previo — diseñado desde cero auditando los 5 consumidores reales que
 * inyectaban el repositorio TypeORM crudo fuera de
 * `project-operational-issues.service.ts` (excepción documentada, misma
 * herramienta de diagnóstico admin que ya excepciona `Project`/`Delivery`/
 * `ProjectAssignment`). Mismo criterio que ARQ-007: sin tipos de TypeORM en
 * la firma.
 */
export const STORAGE_OBJECT_REPOSITORY = Symbol('IStorageObjectRepository');

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewStorageObjectData {
  assetRole: StorageAssetRole;
  projectId: string | null;
  deliveryId: string | null;
  logicalName: string;
  logicalPath: string;
  contentType: string;
  sizeBytes: number;
  hash: string;
  bucket: string;
  objectKey: string;
  uploaderId: string;
}

export interface StorageListQuery {
  deliveryId?: string;
  projectId?: string;
  assetRole?: StorageAssetRole;
  uploaderId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  sortBy: StorageSortField;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}

export interface StorageListPage {
  data: StorageObject[];
  total: number;
}

export interface IStorageObjectRepository {
  /** Con `project`/`delivery.author`/`delivery.assignment.project` cargados, para resolver permisos. */
  findByIdWithRelations(
    id: string,
    includeDeleted?: boolean,
  ): Promise<StorageObject | null>;

  /**
   * Listado paginado con joins de contexto (`project`/`delivery`/`delivery.author`/
   * `delivery.assignment.project`) para poblar `toStorageObjectResponse`, filtrable
   * y ordenable. El scoping por actor (STUDENT solo ve sus propios artefactos
   * `STUDENT_SOURCE`, TEACHER solo los de proyectos donde está asignado, ADMIN
   * sin restricción) se resuelve en la propia consulta.
   */
  findPaginated(
    query: StorageListQuery,
    actor: AuthenticatedUser,
  ): Promise<StorageListPage>;

  /** La suite docente activa de un proyecto (sin orden explícito — normalmente hay como mucho una). */
  findActiveTeacherTestSuite(projectId: string): Promise<StorageObject | null>;

  /** La suite docente más reciente de un proyecto (ordenada por `createdAt` DESC, como mucho 1). */
  findLatestTeacherTestSuite(projectId: string): Promise<StorageObject[]>;

  /** El artefacto fuente del alumno activo para una entrega. */
  findActiveStudentSource(deliveryId: string): Promise<StorageObject | null>;

  /** Todos los artefactos fuente del alumno para una entrega, por antigüedad ascendente. */
  findAllStudentSourcesByDelivery(deliveryId: string): Promise<StorageObject[]>;

  /** Construye la entidad en memoria, sin persistir (paridad con `Repository.create`). */
  create(data: NewStorageObjectData): StorageObject;

  save(storageObject: StorageObject): Promise<StorageObject>;
  softRemove(storageObject: StorageObject): Promise<StorageObject>;
  recover(storageObject: StorageObject): Promise<StorageObject>;
  deleteById(id: string): Promise<void>;
}
