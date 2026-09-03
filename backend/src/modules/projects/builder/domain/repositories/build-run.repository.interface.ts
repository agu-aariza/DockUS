/**
 * @fileoverview Módulo de proyectos académicos y entregas (build-run.repository.interface).
 *
 * @module build-run.repository.interface
 */

import type { AuthenticatedUser } from '../../../../auth/interfaces/authenticated-user.interface';
import { BuildRun, BuildRunStatus } from '../entities/build-run.entity';
import type { SortOrder } from '../../../../../shared/dto/paginated-query.dto';

/**
 * Puerto de ejecuciones sin tipos de TypeORM en la firma. Expresa comandos,
 * consultas y métricas de `BuildRun` sin filtrar detalles del adaptador a la
 * capa de aplicación.
 */

/** Proyección escalar que excluye los jsonb pesados del run. */
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

/** Token de inyección tipado para el repositorio de ejecuciones. */
export const BUILD_RUN_REPOSITORY = Symbol('IBuildRunRepository');

export interface StaleQueuedRunRef {
  id: string;
  deliveryId: string;
}

export interface IBuildRunRepository {
  findById(id: string): Promise<BuildRun | null>;
  findByIdWithDeliveryContext(id: string): Promise<BuildRun | null>;
  findLatestSuccessfulBeforeDeliveryVersion(
    assignmentId: string,
    version: number,
  ): Promise<BuildRun | null>;

  /** Crea y persiste un run nuevo en QUEUED. */
  createQueuedRun(input: {
    deliveryId: string;
    triggeredById: string;
    promptVersion: string | null;
  }): Promise<BuildRun>;

  /**
   * Reclama un run QUEUED y lo pasa a RUNNING en una única sentencia atómica.
   * Devuelve `false` si el run ya no estaba QUEUED porque otro escritor lo
   * canceló o lo reclamó.
   */
  claimQueuedRun(id: string, startedAt: Date): Promise<boolean>;

  /**
   * Persiste el resultado final del pipeline solo si el run sigue RUNNING.
   * Devuelve `false` si otro escritor lo canceló o marcó como FAILED mientras
   * el pipeline estaba calculando el resultado.
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
   * Devuelve `overallOutcome` del run más reciente por entrega para todas las
   * entregas vivas de un proyecto. No carga la entidad completa ni sus jsonb.
   */
  findLatestOutcomeByProject(
    projectId: string,
  ): Promise<Array<{ deliveryId: string; overallOutcome: string | null }>>;

  /** Igual que en el gradebook: solo columnas escalares, sin jsonb pesado. */
  findScalarSummaryByDeliveryIds(
    deliveryIds: string[],
  ): Promise<BuildRunScalarSummary[]>;

  /** UPDATE con GREATEST — evita el N+1 select-then-write por cada evento emitido. */
  bumpLatestEventSequence(id: string, sequence: string): Promise<void>;

  /** Incrementa contadores de consumo (chat con el Tutor IA sobre un run ya evaluado). */
  incrementUsage(id: string, delta: BuildRunUsageDelta): Promise<void>;

  /**
   * Falla el run solo si sigue en un estado activo (QUEUED o RUNNING).
   * Los estados terminales SUCCESS, FAILED y CANCELLED nunca se sobreescriben.
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
