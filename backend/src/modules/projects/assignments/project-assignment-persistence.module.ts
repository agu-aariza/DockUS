/**
 * @fileoverview Módulo hoja para el puerto de persistencia de `ProjectAssignment`.
 *
 * Contexto:
 * - `ProjectsModule` y `BuilderModule` necesitan `PROJECT_ASSIGNMENT_REPOSITORY`,
 * y `ProjectsModule` ya importa `BuilderModule`: un `ProjectAssignment`
 * accesible desde ambos sin crear un ciclo de módulos necesita vivir en un
 * módulo hoja que los dos puedan importar de forma independiente (mismo
 * patrón que `DeliveryStatusModule`).
 *
 * @module ProjectAssignmentPersistenceModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectAssignment } from './entities/project-assignment.entity';
import { ProjectAssignmentRepository } from '../infrastructure/database/project-assignment.repository';
import { PROJECT_ASSIGNMENT_REPOSITORY } from '../domain/repositories/project-assignment.repository.interface';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectAssignment])],
  providers: [
    {
      provide: PROJECT_ASSIGNMENT_REPOSITORY,
      useClass: ProjectAssignmentRepository,
    },
  ],
  exports: [PROJECT_ASSIGNMENT_REPOSITORY],
})
export class ProjectAssignmentPersistenceModule {}
