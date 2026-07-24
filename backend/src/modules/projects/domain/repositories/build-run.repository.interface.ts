import { BuildRun } from '../../builder/domain/entities/build-run.entity';

/**
 * Puerto real (audit/04 ARQ-007): sin tipos de TypeORM en la firma. La
 * versión anterior exponía `SelectQueryBuilder`/`FindOneOptions`/`DeepPartial`
 * directamente, así que `cancelRun`, el sweep de huérfanos y la cuota de
 * gasto escribían SQL-builder de TypeORM "contra la interfaz" en vez de
 * expresar intención. Cada método de aquí corresponde 1:1 a un UPDATE
 * condicionado o SELECT que ya existía — es una mudanza mecánica a
 * `infrastructure/database/build-run.repository.ts`, no un cambio de SQL.
 */

export interface StaleQueuedRunRef {
  id: string;
  deliveryId: string;
}

export interface IBuildRunRepository {
  findById(id: string): Promise<BuildRun | null>;

  /** Persiste el estado completo de `run` (transición a RUNNING, resultado final). */
  save(run: BuildRun): Promise<BuildRun>;

  /** Crea y persiste un run nuevo en QUEUED. */
  createQueuedRun(input: {
    deliveryId: string;
    triggeredById: string;
    promptVersion: string | null;
  }): Promise<BuildRun>;

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
}
