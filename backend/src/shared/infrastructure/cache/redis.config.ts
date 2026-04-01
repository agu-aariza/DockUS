/**
 * @fileoverview Configuración compartida de conexión Redis.
 *
 * Contexto:
 * - Centraliza host y puerto de Redis.
 * - Evita duplicar lectura de configuración en health y colas.
 *
 * @module RedisConfig
 */

import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Construye las opciones base de conexión a Redis.
 */
export function buildRedisConnectionOptions(
  configService: ConfigService,
): RedisOptions {
  return {
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
    password: configService.get<string>('REDIS_PASSWORD'),
  };
}
