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

export function buildBullConfig(configService: ConfigService) {
  return {
    connection: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
    },
  };
}
