/**
 * @fileoverview Servicios runtime y adaptadores técnicos del Builder.
 *
 * Aísla configuración, acceso al workspace y los puertos de Docker, Redis y
 * object storage que consume el pipeline sin exponer sus implementaciones.
 *
 * @module BuilderRuntimeModule
 */

import { Module } from '@nestjs/common';
import { CacheModule } from '../../../shared/infrastructure/cache/cache.module';
import { DistributedLockService } from '../../../shared/infrastructure/cache/distributed-lock.service';
import { DockerExecutionService } from '../../../shared/infrastructure/docker/docker-execution.service';
import { DockerInfrastructureModule } from '../../../shared/infrastructure/docker/docker-infrastructure.module';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { ProjectPersistenceModule } from '../project-persistence.module';
import { StorageModule } from '../storage/storage.module';
import { BuilderAccessService } from './application/services/workspace/builder-access.service';
import { BuilderEnvironmentImageService } from './application/services/workspace/builder-environment-image.service';
import { BuilderWorkspaceService } from './application/services/workspace/builder-workspace.service';
import { SourceCodePayloadBuilder } from './application/services/workspace/source-code-payload-builder.service';
import { BuilderRecipeCompiler } from './application/services/compilation/builder-recipe-compiler.service';
import { BuilderConfigProvider } from './domain/builder-config.provider';
import { CONTAINER_RUNTIME } from './domain/ports/container-runtime.port';
import { DISTRIBUTED_CACHE } from './domain/ports/distributed-cache.port';
import { DISTRIBUTED_LOCK } from './domain/ports/distributed-lock.port';
import { OBJECT_STORAGE } from './domain/ports/object-storage.port';
import { RedisClientService } from '../../../shared/infrastructure/cache/redis-client.service';

@Module({
  imports: [
    CacheModule,
    DockerInfrastructureModule,
    StorageInfrastructureModule,
    DeliveryStatusModule,
    ProjectPersistenceModule,
    StorageModule,
  ],
  providers: [
    {
      provide: CONTAINER_RUNTIME,
      useExisting: DockerExecutionService,
    },
    {
      provide: OBJECT_STORAGE,
      useExisting: MinioStorageService,
    },
    {
      provide: DISTRIBUTED_CACHE,
      useExisting: RedisClientService,
    },
    {
      provide: DISTRIBUTED_LOCK,
      useExisting: DistributedLockService,
    },
    BuilderConfigProvider,
    BuilderAccessService,
    BuilderWorkspaceService,
    SourceCodePayloadBuilder,
    BuilderEnvironmentImageService,
    BuilderRecipeCompiler,
  ],
  exports: [
    CONTAINER_RUNTIME,
    OBJECT_STORAGE,
    DISTRIBUTED_CACHE,
    DISTRIBUTED_LOCK,
    BuilderConfigProvider,
    BuilderAccessService,
    BuilderWorkspaceService,
    SourceCodePayloadBuilder,
    BuilderEnvironmentImageService,
    BuilderRecipeCompiler,
  ],
})
export class BuilderRuntimeModule {}
