/**
 * @fileoverview Submódulo de storage dentro del dominio projects.
 *
 * Contexto:
 * - Registra entidad, servicio y controlador de objetos almacenados.
 * - Integra cliente MinIO compartido con reglas de negocio por entrega.
 *
 * @module StorageModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { StorageObject } from './entities/storage-object.entity';
import { StorageAccessService } from './storage-access.service';
import { StorageController } from './storage.controller';
import { StorageQueryService } from './storage-query.service';
import { StorageService } from './storage.service';
import { StorageUploadService } from './storage-upload.service';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { OBJECT_STORAGE } from '../builder/domain/ports/object-storage.port';
import { StorageObjectRepository } from '../infrastructure/database/storage-object.repository';
import { STORAGE_OBJECT_REPOSITORY } from '../domain/repositories/storage-object.repository.interface';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { ProjectPersistenceModule } from '../project-persistence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StorageObject, ProjectAssignment]),
    StorageInfrastructureModule,
    DeliveryStatusModule,
    ProjectPersistenceModule,
  ],
  controllers: [StorageController],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useExisting: MinioStorageService,
    },
    {
      provide: STORAGE_OBJECT_REPOSITORY,
      useClass: StorageObjectRepository,
    },
    StorageService,
    StorageAccessService,
    StorageQueryService,
    StorageUploadService,
  ],
  exports: [StorageService, STORAGE_OBJECT_REPOSITORY],
})
export class StorageModule {}
