/**
 * @fileoverview Modulo de dominio para gestion de proyectos academicos.
 *
 * Contexto:
 * - Registra entidad, servicio y controlador del contexto projects.
 * - Deja preparado el dominio para extender a nuevas capacidades de entrega.
 *
 * @module ProjectsModule
 */

import { Module } from '@nestjs/common';
import { DeliveryStatusModule } from './deliveries/delivery-status.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { ProjectAssignmentsModule } from './assignments/project-assignments.module';
import { ProjectOperationsModule } from './operations/project-operations.module';
import { ProjectReportingModule } from './reporting/project-reporting.module';
import { ProjectsController } from './presentation/projects.controller';
import { ProjectTestSuiteController } from './presentation/project-test-suite.controller';
import { ProjectTeachersController } from './presentation/project-teachers.controller';
import { ProjectRuntimeController } from './presentation/project-runtime.controller';
import { ProjectAccessModule } from './project-access.module';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectPersistenceModule } from './project-persistence.module';
import { ProjectQueryService } from './project-query.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    StorageModule,
    DeliveryStatusModule,
    ProjectAccessModule,
    ProjectPersistenceModule,
    ProjectAssignmentsModule,
    DeliveriesModule,
    ProjectOperationsModule,
    ProjectReportingModule,
  ],
  controllers: [
    ProjectsController,
    ProjectTestSuiteController,
    ProjectTeachersController,
    ProjectRuntimeController,
  ],
  providers: [ProjectQueryService, ProjectLifecycleService],
  exports: [ProjectLifecycleService, ProjectAccessModule],
})
export class ProjectsModule {}
