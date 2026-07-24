/**
 * @fileoverview Cliente Redis compartido para infraestructura transversal.
 *
 * Contexto:
 * - Centraliza la conexión Redis usada por healthchecks y servicios transversales.
 * - Gestiona reconexión básica y cierre ordenado de la conexión.
 *
 * Nota arquitectónica:
 * Este cliente es intencionalmente independiente de la conexión Redis gestionada
 * por BullMQ. La separación permite:
 * 1. Ejecutar healthchecks sin depender del estado interno de BullMQ.
 * 2. Configurar timeouts agresivos (2s) sin afectar los workers de colas.
 * 3. Desacoplar el ciclo de vida de monitorización del de procesamiento.
 *
 * @module RedisClientService
 */

import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { buildRedisConnectionOptions } from '../../config/redis.config';

const REDIS_TIMEOUT_MS = 2000;

@Injectable()
export class RedisClientService implements OnApplicationShutdown {
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    this.client = this.createClient();
  }

  /**
   * Ejecuta un PING contra Redis usando el cliente compartido.
   */
  async ping(): Promise<string> {
    const client = await this.getClient();

    return this.withTimeout(client.ping());
  }

  async publish(channel: string, payload: string): Promise<number> {
    const client = await this.getClient();
    return this.withTimeout(client.publish(channel, payload));
  }

  /**
   * Primitivas de caché clave-valor.
   *
   * Aceptan un presupuesto de tiempo propio porque el de la clase (2 s) está
   * dimensionado para sondas de salud, donde esperar es preferible a fallar. En
   * una ruta caliente —la validación del JWT corre en cada petición— ese mismo
   * valor convertiría una degradación de Redis en 2 s de latencia añadida a
   * *todas* las peticiones, bastante peor que la consulta que la caché evita.
   * Quien llama decide cuánto está dispuesto a esperar antes de darse por
   * fallido y recurrir al origen.
   */
  async get(key: string, timeoutMs?: number): Promise<string | null> {
    const client = await this.getClient();
    return this.withTimeout(client.get(key), timeoutMs);
  }

  async exists(key: string, timeoutMs?: number): Promise<boolean> {
    const client = await this.getClient();
    const result = await this.withTimeout(client.exists(key), timeoutMs);
    return result > 0;
  }

  /**
   * Incrementa un contador y le fija ventana de caducidad en la misma ida y
   * vuelta. El `EXPIRE` va siempre, no solo cuando el contador arranca: es un
   * contador de ventana deslizante, y refrescarlo mantiene viva la racha
   * mientras los fallos sigan llegando.
   */
  async incrementWithTtl(
    key: string,
    ttlSeconds: number,
    timeoutMs?: number,
  ): Promise<number> {
    const client = await this.getClient();
    const results = await this.withTimeout(
      client.multi().incr(key).expire(key, ttlSeconds).exec(),
      timeoutMs,
    );

    const incremented = results?.[0]?.[1];
    return typeof incremented === 'number' ? incremented : 0;
  }

  async set(
    key: string,
    value: string,
    ttlSeconds: number,
    timeoutMs?: number,
  ): Promise<void> {
    const client = await this.getClient();
    await this.withTimeout(client.set(key, value, 'EX', ttlSeconds), timeoutMs);
  }

  async del(key: string, timeoutMs?: number): Promise<void> {
    const client = await this.getClient();
    await this.withTimeout(client.del(key), timeoutMs);
  }

  /**
   * `SET key value PX ttl NX`: escribe solo si la clave no existe.
   *
   * Es la operación atómica sobre la que se construyen los cerrojos
   * distribuidos. Devuelve `true` si esta llamada fue la que creó la clave.
   */
  async setIfAbsent(
    key: string,
    value: string,
    ttlMs: number,
    timeoutMs?: number,
  ): Promise<boolean> {
    const client = await this.getClient();
    const result = await this.withTimeout(
      client.set(key, value, 'PX', ttlMs, 'NX'),
      timeoutMs,
    );
    return result === 'OK';
  }

  /**
   * Libera una clave **solo si sigue conteniendo el testigo indicado**.
   *
   * La comparación y el borrado tienen que ser atómicos, y por eso va en Lua.
   * Con un `GET` seguido de `DEL` desde el cliente existe una ventana en la que
   * el cerrojo puede vencer entre ambas operaciones y ser readquirido por otro
   * proceso: el `DEL` borraría entonces un cerrojo ajeno y ambos titulares
   * creerían tenerlo en exclusiva, que es justo lo que el cerrojo debía evitar.
   */
  async releaseIfMatches(
    key: string,
    token: string,
    timeoutMs?: number,
  ): Promise<boolean> {
    const client = await this.getClient();
    const script =
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
    const result = await this.withTimeout(
      client.eval(script, 1, key, token) as Promise<number>,
      timeoutMs,
    );
    return result === 1;
  }

  createSubscriber(): Redis {
    return this.createClient();
  }

  /**
   * Cierra la conexión Redis cuando la aplicación se apaga.
   */
  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'end' || this.client.status === 'wait') {
      this.client.disconnect();
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  /**
   * Crea una instancia de cliente Redis con la configuración compartida.
   */
  private createClient(): Redis {
    return new Redis({
      ...buildRedisConnectionOptions(this.configService),
      commandTimeout: REDIS_TIMEOUT_MS,
      connectTimeout: REDIS_TIMEOUT_MS,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  /**
   * Devuelve un cliente listo para operar.
   */
  private async getClient(): Promise<Redis> {
    if (this.client.status === 'end') {
      this.client = this.createClient();
    }

    if (this.client.status === 'wait') {
      await this.client.connect();
    }

    return this.client;
  }

  /**
   * Aplica un timeout defensivo a operaciones de Redis.
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = REDIS_TIMEOUT_MS,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis no respondio dentro del tiempo esperado.'));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeout);
          resolve(value);
        })
        .catch((error: unknown) => {
          clearTimeout(timeout);
          reject(
            error instanceof Error
              ? error
              : new Error('Error no tipado al consultar Redis.'),
          );
        });
    });
  }
}
