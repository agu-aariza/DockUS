/**
 * @fileoverview Puerto de caché distribuida para señales de cancelación (distributed-cache.port).
 *
 * @module distributed-cache.port
 */

/**
 * Contrato mínimo de caché distribuida para publicar y consultar señales de
 * cancelación. El TTL se expresa en segundos y la ausencia de una clave se
 * interpreta como una ejecución que no está marcada para cancelarse.
 */
export interface IDistributedCache {
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export const DISTRIBUTED_CACHE = Symbol('IDistributedCache');
