/**
 * @fileoverview Módulo de caché compartida.
 *
 * Contexto:
 * - Agrupa el cliente Redis transversal y las cachés construidas sobre él.
 * - Existe para que `UsersModule` y `AuthModule` puedan inyectar la caché de
 *   identidad sin arrastrar `InfrastructureModule` entero (TypeORM, BullMQ,
 *   Docker, Bedrock) por una única dependencia.
 *
 * `RedisClientService` se declara **aquí y solo aquí**:
 * `InfrastructureModule` lo reexporta desde este módulo en vez de proveerlo por
 * su cuenta. Si ambos lo declarasen, Nest crearía dos instancias y con ellas
 * dos conexiones a Redis, y las invalidaciones de un lado no se verían desde el
 * otro.
 *
 * @module CacheModule
 */

import { Module } from '@nestjs/common';
import { AuthIdentityCacheService } from './auth-identity-cache.service';
import { DistributedLockService } from './distributed-lock.service';
import { RedisClientService } from './redis-client.service';

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
