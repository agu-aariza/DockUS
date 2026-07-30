/**
 * @fileoverview Puerto de caché distribuida para señales de cancelación (distributed-cache.port).
 *
 * @module distributed-cache.port
 */

/**
 * Plan de arquitectura hexagonal, Fase 1 (P1-4, ver
 * ARQ-007). `RedisClientService` tiene una
 * superficie mucho más amplia (rate-limiting, pub/sub, primitivas de lock)
 * pero solo un consumidor real fuera de `shared/infrastructure/` necesita un
 * puerto: `BuilderRunCancellationService`, y solo usa `set`/`exists` — el
 * resto de consumidores externos (`builder-run-events.service.ts`,
 * `modules/health/health.service.ts`) viven en la propia capa de
 * infraestructura o son código operativo, no lógica de dominio/aplicación
 * acoplada a "que sea Redis" — no forman parte de este puerto a propósito
 * (infra-a-infra no viola ninguna regla de capas).
 */
export interface IDistributedCache {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const DISTRIBUTED_CACHE = Symbol('IDistributedCache');
