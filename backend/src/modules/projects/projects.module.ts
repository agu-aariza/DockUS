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
import { StudentProfileController } from './presentation/student-profile.controller';
import { StudentProfileService } from './student-profile.service';
import { SharedApplicationModule } from '../../shared/application/shared-application.module';
import { ProjectAssignmentsController } from './presentation/project-assignments.controller';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { ProjectAssignmentGroupEnrollmentListener } from './assignments/project-assignment-group-enrollment.listener';
import { ProjectAssignmentsService } from './assignments/project-assignments.service';
import { ProjectAssignmentPersistenceModule } from './assignments/project-assignment-persistence.module';
import { BuilderModule } from './builder/builder.module';
import { DeliveriesController } from './presentation/deliveries.controller';
import { DeliveriesQueryService } from './deliveries/deliveries-query.service';
import { DeliveriesCommandService } from './deliveries/deliveries-command.service';
import { DeliveryStatusModule } from './deliveries/delivery-status.module';
import { Delivery } from './deliveries/entities/delivery.entity';
import { UsersModule } from '../users/users.module';
import { ProjectsController } from './presentation/projects.controller';
import { ProjectTestSuiteController } from './presentation/project-test-suite.controller';
import { ProjectTeachersController } from './presentation/project-teachers.controller';
import { ProjectRuntimeController } from './presentation/project-runtime.controller';
import { ProjectGradebookController } from './presentation/project-gradebook.controller';
import { ProjectAccessService } from './project-access.service';
import { ProjectGradebookService } from './project-gradebook.service';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectOperationalIssuesService } from './project-operational-issues.service';
import { ProjectPersistenceModule } from './project-persistence.module';
import { ProjectsService } from './projects.service';
import { StorageObject } from './storage/entities/storage-object.entity';
import { StorageModule } from './storage/storage.module';
import { StorageInfrastructureModule } from '../../shared/infrastructure/storage/storage-infrastructure.module';
import { MinioStorageService } from '../../shared/infrastructure/storage/minio-storage.service';
import { OBJECT_STORAGE } from './domain/ports/object-storage.port';

@Module({
  imports: [
    // Solo para ProjectOperationalIssuesService (excepción documentada,
    // CLAUDE.md): inyecta Repository<T> de TypeORM crudo para SQL de
    // diagnóstico, no vía puerto. El resto de servicios de este módulo
    // consumen las entidades a través de los puertos importados abajo.
    TypeOrmModule.forFeature([ProjectAssignment, Delivery, StorageObject]),
    StorageModule,
    StorageInfrastructureModule,
    BuilderModule,
    AcademicModule,
    SharedApplicationModule,
    DeliveryStatusModule,
    ProjectPersistenceModule,
    ProjectAssignmentPersistenceModule,
    UsersModule,
  ],
  controllers: [
    ProjectsController,
    ProjectTestSuiteController,
    ProjectTeachersController,
    ProjectRuntimeController,
    ProjectGradebookController,
    StudentProfileController,
    DeliveriesController,
    ProjectAssignmentsController,
  ],
  providers: [
    {
      provide: OBJECT_STORAGE,
      useExisting: MinioStorageService,
    },
    ProjectsService,
    ProjectLifecycleService,
    ProjectAccessService,
    ProjectGradebookService,
    StudentProfileService,
    ProjectOperationalIssuesService,
    DeliveriesQueryService,
    DeliveriesCommandService,
    ProjectAssignmentsService,
    ProjectAssignmentGroupEnrollmentListener,
  ],
  exports: [
    ProjectsService,
    ProjectLifecycleService,
    ProjectAccessService,
    DeliveriesQueryService,
    DeliveriesCommandService,
    ProjectAssignmentsService,
    BuilderModule,
  ],
})
export class ProjectsModule {}
