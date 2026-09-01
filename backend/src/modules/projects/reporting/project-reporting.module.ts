/**
 * @fileoverview Módulo de reporting y seguimiento académico de proyectos.
 *
 * @module ProjectReportingModule
 */

import { Module } from '@nestjs/common';
import { AcademicModule } from '../../academic/academic.module';
import { UsersModule } from '../../users/users.module';
import { BuilderModule } from '../builder/builder.module';
import { ProjectAccessModule } from '../project-access.module';
import { ProjectAssignmentPersistenceModule } from '../assignments/project-assignment-persistence.module';
import { DeliveryStatusModule } from '../deliveries/delivery-status.module';
import { ProjectPersistenceModule } from '../project-persistence.module';
import { ProjectGradebookController } from '../presentation/project-gradebook.controller';
import { StudentProfileController } from '../presentation/student-profile.controller';
import { ProjectGradebookService } from '../project-gradebook.service';
import { ProjectQualityInsightsService } from '../project-quality-insights.service';
import { StudentProfileService } from '../student-profile.service';

@Module({
  imports: [
    AcademicModule,
    UsersModule,
    BuilderModule,
    ProjectAccessModule,
    ProjectAssignmentPersistenceModule,
    DeliveryStatusModule,
    ProjectPersistenceModule,
  ],
  controllers: [ProjectGradebookController, StudentProfileController],
  providers: [
    ProjectGradebookService,
    ProjectQualityInsightsService,
    StudentProfileService,
  ],
  exports: [
    ProjectGradebookService,
    ProjectQualityInsightsService,
    StudentProfileService,
  ],
})
export class ProjectReportingModule {}
