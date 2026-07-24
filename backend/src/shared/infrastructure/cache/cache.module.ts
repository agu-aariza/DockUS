/**
 * @fileoverview Módulo de caché y cerrojos distribuidos basados en Redis.
 *
 * @description
 * Proporciona los servicios centrales de Redis para:
 * 1. `RedisClientService`: Conexión cliente ioredis singleton.
 * 2. `AuthIdentityCacheService`: Caché de corta duración para credenciales/roles JWT.
 * 3. `DistributedLockService`: Bloqueos distribuidos basados en Redis con renovación automática (Redlock/atomic TTL).
 *
 * Permite a los módulos de dominio inyectar utilidades de caché sin importar el módulo completo de infraestructura.
 *
 * @module CacheModule
 */

import { Module } from '@nestjs/common';
import { AuthIdentityCacheService } from './auth-identity-cache.service';
import { DistributedLockService } from './distributed-lock.service';
import { RedisClientService } from './redis-client.service';

/**
 * Módulo de servicios de caché e infraestructura Redis.
 */
@Module({
  providers: [
    RedisClientService,
    AuthIdentityCacheService,
    DistributedLockService,
  ],
  exports: [
    RedisClientService,
    AuthIdentityCacheService,
    DistributedLockService,
  ],
})
export class CacheModule {}
