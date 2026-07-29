/**
 * @fileoverview Puerto de persistencia de `Delivery` (delivery.repository.interface).
 *
 * @module delivery.repository.interface
 */

import type { AuthenticatedUser } from '../../../auth/interfaces/authenticated-user.interface';
import {
  Delivery,
  DeliveryStatus,
} from '../../deliveries/entities/delivery.entity';
import type { DeliverySortField } from '../../deliveries/dto/list-deliveries-query.dto';
import type { SortOrder } from '../../../../shared/dto/paginated-query.dto';

/**
 * Puerto real (audit/areas/arquitectura/plan_accion.md P2-1): mismo criterio
 * que ARQ-007 aplicó a `IProjectRepository`/`IBuildRunRepository` — sin tipos
 * de TypeORM en la firma (nada de `SelectQueryBuilder`/`FindOneOptions`/
 * `Repository`).
 *
 * A diferencia de esos dos puertos, este sí expone escritura
 * (`create`/`save`/`softRemove`/`recover`): `ProjectLifecycleService` es el
 * único que crea/persiste `Project` y bypasea el puerto por decisión
 * explícita (ver `project.repository.interface.ts`), pero `Delivery` no tiene
 * un caso análogo — `DeliveriesCommandService` es el dueño natural de su
 * mutación y no hay motivo para dejarlo fuera del puerto.
 */
export const DELIVERY_REPOSITORY = Symbol('IDeliveryRepository');

/** Campos aceptados por `Repository.create()` — construcción en memoria, sin persistir. */
export interface NewDeliveryData {
  assignmentId: string;
  authorId: string;
  version: number;
  status: DeliveryStatus;
  notes: string | null;
  isLate: boolean;
  grade: number | null;
  graderNotes: string | null;
}

export interface DeliveryListQuery {
  page: number;
  limit: number;
  sortBy: DeliverySortField;
  sortOrder: SortOrder;
  projectId?: string;
  assignmentId?: string;
  authorId?: string;
  status?: DeliveryStatus;
}

export interface DeliveryListPage {
  deliveries: Delivery[];
  total: number;
}

export interface IDeliveryRepository {
  /** Búsqueda plana, sin relaciones — para mutación interna de estado (ARQ-003). */
  findById(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null>;

  /** Con `assignment.project`/`assignment.student` cargados. */
  findByIdWithAssignment(
    id: string,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null>;

  /** Igual que `findByIdWithAssignment`, pero solo si `actor` puede verla. */
  findByIdForActor(
    id: string,
    actor: AuthenticatedUser,
    options?: { includeDeleted?: boolean },
  ): Promise<Delivery | null>;

  /** Listado paginado y filtrado, restringido a lo visible por `actor`. */
  findAllForActor(
    query: DeliveryListQuery,
    actor: AuthenticatedUser,
  ): Promise<DeliveryListPage>;

  /** Todas las entregas de un conjunto de asignaciones (gradebook, timeline de alumno). */
  findByAssignmentIds(
    assignmentIds: string[],
    options: { orderBy: 'createdAt' | 'version'; orderDirection: SortOrder },
  ): Promise<Delivery[]>;

  /** Por id, sin relaciones — candidatos de limpieza operativa. */
  findByIds(ids: string[]): Promise<Delivery[]>;

  /** Mayor versión emitida para una asignación. 0 si no hay ninguna. */
  resolveMaxVersionForAssignment(assignmentId: string): Promise<number>;

  /** Mayor versión emitida en cualquier asignación de un proyecto. 0 si no hay ninguna. */
  resolveMaxVersionForProject(projectId: string): Promise<number>;

  /** Mayor versión por cada `assignmentId` dado, en una sola agregación. */
  resolveMaxVersionsByAssignmentIds(
    assignmentIds: string[],
  ): Promise<Map<string, number>>;

  /** Construye la entidad en memoria, sin persistir (paridad con `Repository.create`). */
  create(data: NewDeliveryData): Delivery;

  save(delivery: Delivery): Promise<Delivery>;
  saveMany(deliveries: Delivery[]): Promise<Delivery[]>;

  softRemove(delivery: Delivery): Promise<Delivery>;
  softRemoveMany(deliveries: Delivery[]): Promise<Delivery[]>;

  recover(delivery: Delivery): Promise<Delivery>;
}
