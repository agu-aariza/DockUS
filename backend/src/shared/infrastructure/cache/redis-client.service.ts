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
import { buildRedisConnectionOptions } from './redis.config';

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
  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Redis no respondio dentro del tiempo esperado.'));
      }, REDIS_TIMEOUT_MS);

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
