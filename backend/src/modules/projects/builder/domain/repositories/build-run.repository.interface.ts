/**
 * @fileoverview Módulo de proyectos académicos y entregas (build-run.repository.interface).
 *
 * @module build-run.repository.interface
 */

import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { BuildRun, BuildRunStatus } from '../entities/build-run.entity';
import type { SortOrder } from '../../../../../shared/dto/paginated-query.dto';

/**
 * Puerto real (audit/04 ARQ-007): sin tipos de TypeORM en la firma. La
 * versión anterior exponía `SelectQueryBuilder`/`FindOneOptions`/`DeepPartial`
 * directamente, así que `cancelRun`, el sweep de huérfanos y la cuota de
 * gasto escribían SQL-builder de TypeORM "contra la interfaz" en vez de
 * expresar intención. Cada método de aquí corresponde 1:1 a un UPDATE
 * condicionado o SELECT que ya existía — es una mudanza mecánica a
 * `builder/infrastructure/database/build-run.repository.ts`, no un cambio de SQL.
 *
 * Ampliado en la Fase 2 P2-4 (`ARQ-007`) para
 * cubrir los 6 consumidores reales que hasta entonces inyectaban
 * `Repository<BuildRun>` directo.
 */

/** Proyección escalar: excluye deliberadamente `report`/`llmAssessment`/`codeQualityFindings` (jsonb pesado, ESC-CRIT-05). */
export interface BuildRunScalarSummary {
  id: string;
  deliveryId: string;
  status: BuildRunStatus;
  createdAt: Date;
  finishedAt: Date | null;
  inputTokens: number;
  outputTokens: number;
  executionCostUsd: number;
}

export interface BuildRunUsageDelta {
  inputTokens: number;
  outputTokens: number;
  executionCostUsd: number;
}

export interface BuildRunListQuery {
  status?: BuildRunStatus;
  page: number;
  limit: number;
  sortOrder: SortOrder;
}

export interface BuildRunListPage {
  data: BuildRun[];
  total: number;
}

/** Campos que persiste un `BuildRun` al completar el pipeline con éxito. */
export interface BuildRunResultPatch {
  finishedAt: Date;
  llmAssessment: unknown;
  llmReasoning: string | null;
  warnings: string[];
  codeQualityFindings: unknown;
  report: unknown;
  inputTokens: number;
  outputTokens: number;
  executionCostUsd: number;
}

/**
 * Token de inyección tipado (audit/areas/arquitectura ARQ-020, plan_accion.md
 * P0-2). Ver el comentario equivalente en `project.repository.interface.ts`.
 */
export const BUILD_RUN_REPOSITORY = Symbol('IBuildRunRepository');

export interface StaleQueuedRunRef {
  id: string;
  deliveryId: string;
}

export interface IBuildRunRepository {
  findById(id: string): Promise<BuildRun | null>;

  /** Crea y persiste un run nuevo en QUEUED. */
  createQueuedRun(input: {
    deliveryId: string;
    triggeredById: string;
    promptVersion: string | null;
  }): Promise<BuildRun>;

  /**
   * UPDATE condicionado (ORC-001): reclama un run QUEUED y lo pasa a
   * RUNNING en una única sentencia atómica — reemplaza el antiguo
   * `findById` + mutar en memoria + `save()`, que dependía de que
   * `repository.save()` de TypeORM aplicara el optimistic lock del
   * `@VersionColumn` de forma atómica. Una sonda directa contra Postgres
   * demostró que no lo hace: un escritor con una entidad obsoleta podía
   * pisar una cancelación ya confirmada sin lanzar
   * `OptimisticLockVersionMismatchError`. Devuelve `false` si el run ya no
   * estaba QUEUED (cancelado, o reclamado por otro worker).
   */
  claimQueuedRun(id: string, startedAt: Date): Promise<boolean>;

  /**
   * UPDATE condicionado (ORC-001): persiste el resultado final del pipeline
   * solo si el run seguía RUNNING. Devuelve `false` si ya no lo estaba
   * (cancelado, o marcado FAILED por otra vía) — en ese caso el resultado
   * calculado se descarta sin reintentar: sea cual sea el motivo por el que
   * ya no está RUNNING, esa transición ya la decidió otro escritor y no debe
   * pisarse con un resultado calculado en memoria contra un estado viejo.
   */
  completeRunningRun(id: string, patch: BuildRunResultPatch): Promise<boolean>;

  /**
   * UPDATE condicionado: cancela solo si sigue QUEUED/RUNNING. Devuelve si
   * cambió algo — `false` significa que el run ya había terminado.
   */
  cancelIfActive(id: string): Promise<boolean>;

  /**
   * UPDATE condicionado: RUNNING con `updatedAt` anterior a `staleThresholdDate`
   * pasan a FAILED (huérfanos tras un reinicio). Devuelve cuántas filas tocó.
   */
  failStaleRunning(staleThresholdDate: Date): Promise<number>;

  /**
   * QUEUED con `updatedAt` anterior a `staleThresholdDate`, las más antiguas
   * primero, topado en `limit`. Candidatos a reconciliar contra la cola.
   */
  findStaleQueued(
    staleThresholdDate: Date,
    limit: number,
  ): Promise<StaleQueuedRunRef[]>;

  /**
   * UPDATE condicionado: falla el run solo si sigue QUEUED (perdido en cola,
   * no se pudo reencolar). Devuelve si transicionó.
   */
  failIfStillQueued(id: string, reason: string): Promise<boolean>;

  /** Suma de `executionCostUsd` de todos los runs de un proyecto. */
  sumExecutionCostUsdByProject(projectId: string): Promise<number>;

  /**
   * `overallOutcome` (extraído del jsonb `report`) del run más reciente por
   * entrega, para todas las entregas vivas de un proyecto. ESC-CRIT-05: no
   * carga la entidad completa, solo esta columna derivada.
   */
  findLatestOutcomeByProject(
    projectId: string,
  ): Promise<Array<{ deliveryId: string; overallOutcome: string | null }>>;

  /** Igual que ESC-CRIT-05 en el gradebook: solo columnas escalares, sin jsonb pesado. */
  findScalarSummaryByDeliveryIds(
    deliveryIds: string[],
  ): Promise<BuildRunScalarSummary[]>;

  /** UPDATE con GREATEST — evita el N+1 select-then-write por cada evento emitido. */
  bumpLatestEventSequence(id: string, sequence: string): Promise<void>;

  /** Incrementa contadores de consumo (chat con el Tutor IA sobre un run ya evaluado). */
  incrementUsage(id: string, delta: BuildRunUsageDelta): Promise<void>;

  /**
   * UPDATE condicionado: falla el run solo si sigue en un estado activo
   * (QUEUED o RUNNING). Antes (`failIfNotCancelled`) el WHERE era
   * `status != CANCELLED`, que también dejaba pasar SUCCESS/FAILED — ORC-002
   * confirmó que un fallo posterior (p. ej. al persistir el evento
   * RUN_COMPLETED) podía degradar un run ya SUCCESS a FAILED. FAILED es
   * ahora absorbente igual que SUCCESS y CANCELLED: nunca se sobreescribe un
   * terminal ya escrito. Devuelve si transicionó.
   */
  failIfActive(id: string, reason: string): Promise<boolean>;

  /** Runs de una entrega, paginados y opcionalmente filtrados por estado. */
  findPaginatedByDelivery(
    deliveryId: string,
    query: BuildRunListQuery,
  ): Promise<BuildRunListPage>;

  /**
   * Último run por cada entrega dada (DISTINCT ON), restringido a lo visible
   * por `actor`: STUDENT solo sus propias entregas, TEACHER solo las de
   * proyectos en los que está asignado, ADMIN todas.
   */
  findLatestByDeliveryIdsForActor(
    deliveryIds: string[],
    actor: AuthenticatedUser,
  ): Promise<BuildRun[]>;
}
