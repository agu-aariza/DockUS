/**
 * @fileoverview Puerto de cerrojo distribuido (distributed-lock.port).
 *
 * @module distributed-lock.port
 */

/**
 * Contrato mínimo para adquirir un cerrojo distribuido y ejecutar una sección
 * crítica. El resultado siempre incluye el valor de la operación y si se obtuvo
 * el cerrojo; una implementación puede devolver el resultado sin garantía
 * exclusiva cuando vence la espera o Redis no está disponible.
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
