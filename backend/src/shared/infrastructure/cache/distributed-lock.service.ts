/**
 * @fileoverview Servicio de cerrojos distribuidos (Distributed Lock) sobre Redis.
 *
 * @description
 * Proporciona exclusión mutua distribuida atómica (`SET resource_key my_random_value NX PX ttl`)
 * para sincronizar tareas pesadas e intensivas en CPU/red ejecutadas en paralelo por múltiples workers.
 *
 * Ejemplos de uso:
 * - Evitar la construcción duplicada simultánea de imágenes efímeras de Docker con el mismo hash de entorno.
 * - Evitar condiciones de carrera en operaciones de mutación de estado global.
 *
 * @module DistributedLockService
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisClientService } from './redis-client.service';

export interface LockOptions {
  /**
   * Vida del cerrojo. Debe superar con holgura la duración esperada de la
   * sección crítica: si vence antes de tiempo, otro proceso entra y se pierde
   * la exclusión. Es el parámetro delicado de este mecanismo.
   */
  ttlMs: number;
  /** Cuánto espera un aspirante a que el titular termine antes de rendirse. */
  waitTimeoutMs?: number;
  /** Intervalo entre reintentos de adquisición. */
  retryIntervalMs?: number;
}

export interface LockOutcome<T> {
  result: T;
  /**
   * `false` cuando se ejecutó sin haber obtenido el cerrojo —porque venció la
   * espera o porque Redis no estaba disponible—. Quien llama puede querer
   * registrarlo: significa que la exclusión mutua no se llegó a garantizar.
   */
  acquired: boolean;
}

const DEFAULT_RETRY_INTERVAL_MS = 500;

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);

  constructor(private readonly redisClientService: RedisClientService) {}

  /**
   * Ejecuta `critical` bajo exclusión mutua sobre `key`.
   *
   * Si otro proceso tiene el cerrojo, espera hasta `waitTimeoutMs`. Agotada la
   * espera ejecuta de todos modos: se prefiere trabajo duplicado a un fallo, y
   * `acquired: false` deja constancia de que ocurrió.
   *
   * `onWaitedForOther` permite a quien llama comprobar, tras la espera, si el
   * trabajo ya lo hizo el titular del cerrojo (para la construcción de imágenes:
   * volver a preguntar si la imagen ya existe) y ahorrárselo.
   */
  async withLock<T>(
    key: string,
    options: LockOptions,
    critical: () => Promise<T>,
  ): Promise<LockOutcome<T>> {
    const token = randomUUID();
    const namespacedKey = `lock:${key}`;
    const waitTimeoutMs = options.waitTimeoutMs ?? 0;
    const retryIntervalMs =
      options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;

    const deadline = Date.now() + waitTimeoutMs;
    // Sin inicializador: el cuerpo del bucle siempre asigna antes de leerlo o
    // sale por `return`, de modo que un `false` inicial sería código muerto.
    let acquired: boolean;

    do {
      try {
        acquired = await this.redisClientService.setIfAbsent(
          namespacedKey,
          token,
          options.ttlMs,
        );
      } catch (error) {
        // Redis inaccesible: no se puede coordinar, pero tampoco se bloquea.
        this.logger.warn(
          JSON.stringify({
            event: 'distributed_lock_unavailable',
            key,
            detail: error instanceof Error ? error.message : String(error),
          }),
        );
        return { result: await critical(), acquired: false };
      }

      if (acquired || Date.now() >= deadline) {
        break;
      }

      await this.sleep(Math.min(retryIntervalMs, deadline - Date.now()));
    } while (Date.now() < deadline);

    try {
      return { result: await critical(), acquired };
    } finally {
      if (acquired) {
        try {
          await this.redisClientService.releaseIfMatches(namespacedKey, token);
        } catch {
          // El cerrojo vencerá solo por TTL. No hay nada mejor que hacer aquí y
          // propagar el error taparía el resultado real de la sección crítica.
        }
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}
