/**
 * @fileoverview Configuración de BullMQ sobre Redis.
 *
 * Contexto:
 * - Centraliza host y puerto de Redis para colas y workers.
 * - Evita duplicar acceso a entorno en módulos de dominio.
 *
 * @module BullConfig
 */

import { ConfigService } from '@nestjs/config';
import { buildRedisConnectionOptions } from '../cache/redis.config';

export function buildBullConfig(configService: ConfigService) {
  return {
    connection: buildRedisConnectionOptions(configService),
  };
}
