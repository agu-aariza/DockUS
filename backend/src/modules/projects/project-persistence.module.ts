/**
 * @fileoverview Módulo hoja para el puerto de persistencia de `Project`.
 *
 * Contexto:
 * - `ProjectsModule`, `BuilderModule` y `StorageModule` necesitan
 * `PROJECT_REPOSITORY`, y `ProjectsModule` ya importa a los otros dos: un
 * `Project` accesible desde los tres sin crear un ciclo de módulos necesita
 * vivir en un módulo hoja que los tres puedan importar de forma
 * independiente (mismo patrón que `DeliveryStatusModule`).
 *
 * @module ProjectPersistenceModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectRepository } from './infrastructure/database/project.repository';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [
    {
      provide: PROJECT_REPOSITORY,
      useClass: ProjectRepository,
    },
  ],
  exports: [PROJECT_REPOSITORY],
})
export class ProjectPersistenceModule {}
