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
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicModule } from '../academic/academic.module';
import { ProjectAssignmentsController } from './assignments/project-assignments.controller';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { ProjectAssignmentsService } from './assignments/project-assignments.service';
import { BuilderModule } from './builder/builder.module';
import { BuildRun } from './builder/domain/entities/build-run.entity';
import { DeliveriesController } from './deliveries/deliveries.controller';
import { DeliveriesService } from './deliveries/deliveries.service';
import { Delivery } from './deliveries/entities/delivery.entity';
import { User } from '../users/entities/user.entity';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectAccessService } from './project-access.service';
import { ProjectGradebookService } from './project-gradebook.service';
import { ProjectOperationalIssuesService } from './project-operational-issues.service';
import { ProjectsService } from './projects.service';
import { ProjectRuntimeModule } from './runtime/project-runtime.module';
import { StorageObject } from './storage/entities/storage-object.entity';
import { StorageModule } from './storage/storage.module';
import { StorageInfrastructureModule } from '../../shared/infrastructure/storage/storage-infrastructure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectAssignment,
      Delivery,
      BuildRun,
      User,
      StorageObject,
    ]),
    StorageModule,
    StorageInfrastructureModule,
    ProjectRuntimeModule,
    BuilderModule,
    AcademicModule,
  ],
  controllers: [
    ProjectsController,
    DeliveriesController,
    ProjectAssignmentsController,
  ],
  providers: [
    ProjectsService,
    ProjectAccessService,
    ProjectGradebookService,
    ProjectOperationalIssuesService,
    DeliveriesService,
    ProjectAssignmentsService,
  ],
  exports: [
    ProjectsService,
    ProjectAccessService,
    DeliveriesService,
    ProjectAssignmentsService,
  ],
})
export class ProjectsModule {}
