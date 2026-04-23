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
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { StorageObject } from './entities/storage-object.entity';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorageObject,
      Delivery,
      Project,
      ProjectAssignment,
    ]),
    StorageInfrastructureModule,
  ],
  controllers: [StorageController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
