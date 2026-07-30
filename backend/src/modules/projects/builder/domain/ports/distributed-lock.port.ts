/**
 * @fileoverview Puerto de cerrojo distribuido (distributed-lock.port).
 *
 * @module distributed-lock.port
 */

/**
 * Plan de arquitectura hexagonal, Fase 1 (P1-4, ver
 * ARQ-007). Redefine `LockOptions`/
 * `LockOutcome<T>` en vez de reutilizar los de `distributed-lock.service.ts`:
 * ese fichero no es un módulo puro de tipos (clase `@Injectable`), así que no
 * calificaría para la excepción de `.dependency-cruiser.cjs` — mismo criterio
 * que `IObjectStorage`. Son solo 5 campos sobre primitivas, sin dependencias
 * propias, así que duplicarlos es barato.
 */
export interface DistributedLockOptions {
  /** Vida del cerrojo — debe superar con holgura la sección crítica. */
  ttlMs: number;
  /** Cuánto espera un aspirante antes de rendirse y ejecutar sin garantía. */
  waitTimeoutMs?: number;
  /** Intervalo entre reintentos de adquisición. */
  retryIntervalMs?: number;
}

export interface DistributedLockOutcome<T> {
  result: T;
  /** `false` si se ejecutó sin haber obtenido el cerrojo (venció la espera o Redis no respondía). */
  acquired: boolean;
}

export interface IDistributedLock {
  withLock<T>(
    key: string,
    options: DistributedLockOptions,
    critical: () => Promise<T>,
  ): Promise<DistributedLockOutcome<T>>;
}

export const DISTRIBUTED_LOCK = Symbol('IDistributedLock');
