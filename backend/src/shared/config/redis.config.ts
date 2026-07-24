/**
 * @fileoverview Opciones de configuración de conexión a Redis (ioredis / BullMQ).
 *
 * @description
 * Proporciona funciones de fábrica para construir las opciones de conexión
 * a la instancia de Redis tanto para el cliente de ioredis como para BullMQ.
 *
 * @module RedisConfig
 */

import { ConfigService } from '@nestjs/config';
import { RedisOptions } from 'ioredis';

/**
 * Construye las opciones de conexión para el cliente ioredis.
 *
 * @param configService - Servicio de configuración de NestJS.
 * @returns Objeto de opciones de conexión RedisOptions.
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

/**
 * Construye la configuración de conexión requerida por los módulos BullMQ.
 *
 * @param configService - Servicio de configuración de NestJS.
 * @returns Objeto con la propiedad `connection` formateada para BullMQ.
 */
export function buildBullConfig(configService: ConfigService) {
  return {
    connection: buildRedisConnectionOptions(configService),
  };
}
