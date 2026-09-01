/**
 * @fileoverview Módulo de autorización transversal del dominio projects.
 *
 * Contexto:
 * - Agrupa los puertos de persistencia que necesita la política de acceso.
 * - Expone una única instancia de ProjectAccessService a los consumidores.
 *
 * @module ProjectAccessModule
 */

import { Module } from '@nestjs/common';
import { ProjectAssignmentPersistenceModule } from './assignments/project-assignment-persistence.module';
import { ProjectPersistenceModule } from './project-persistence.module';
import { ProjectAccessService } from './project-access.service';

@Module({
  imports: [ProjectPersistenceModule, ProjectAssignmentPersistenceModule],
  providers: [ProjectAccessService],
  exports: [ProjectAccessService],
})
export class ProjectAccessModule {}
