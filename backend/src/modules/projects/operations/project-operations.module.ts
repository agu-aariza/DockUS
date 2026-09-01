/**
 * @fileoverview Módulo de operaciones administrativas de proyectos.
 *
 * Contexto:
 * - Aísla el diagnóstico y reconciliación de inconsistencias operativas.
 * - Es el único módulo que registra las entidades raw necesarias para esas
 *   consultas de mantenimiento.
 *
 * @module ProjectOperationsModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAccessModule } from '../project-access.module';
import { ProjectAssignment } from '../assignments/entities/project-assignment.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { OBJECT_STORAGE } from '../builder/domain/ports/object-storage.port';
import { MinioStorageService } from '../../../shared/infrastructure/storage/minio-storage.service';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { ProjectOperationalIssuesService } from '../project-operational-issues.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectAssignment, Delivery, StorageObject]),
    ProjectAccessModule,
    StorageInfrastructureModule,
  ],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useExisting: MinioStorageService,
    },
    ProjectOperationalIssuesService,
  ],
  exports: [ProjectOperationalIssuesService],
})
export class ProjectOperationsModule {}
