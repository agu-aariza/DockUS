/**
 * @fileoverview Módulo de asignaciones de alumnos a proyectos.
 *
 * @module ProjectAssignmentsModule
 */

import { Module } from '@nestjs/common';
import { AcademicModule } from '../../academic/academic.module';
import { SharedApplicationModule } from '../../../shared/application/shared-application.module';
import { UsersModule } from '../../users/users.module';
import { ProjectAccessModule } from '../project-access.module';
import { ProjectPersistenceModule } from '../project-persistence.module';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { ProjectAssignmentPersistenceModule } from './project-assignment-persistence.module';
import { ProjectAssignmentGroupEnrollmentListener } from './project-assignment-group-enrollment.listener';
import { ProjectAssignmentsService } from './project-assignments.service';
import { ProjectAssignmentsController } from '../presentation/project-assignments.controller';

@Module({
  imports: [
    AcademicModule,
    SharedApplicationModule,
    UsersModule,
    ProjectAccessModule,
    ProjectPersistenceModule,
    DeliveryStatusModule,
    ProjectAssignmentPersistenceModule,
  ],
  controllers: [ProjectAssignmentsController],
  providers: [
    ProjectAssignmentsService,
    ProjectAssignmentGroupEnrollmentListener,
  ],
  exports: [ProjectAssignmentsService],
})
export class ProjectAssignmentsModule {}
