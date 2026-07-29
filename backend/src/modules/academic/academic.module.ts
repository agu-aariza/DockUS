/**
 * @fileoverview Módulo académico de grupos y matrículas (academic.module).
 *
 * @module academic.module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseGroup } from './entities/course-group.entity';
import { GroupEnrollment } from './entities/group-enrollment.entity';
import { GroupsService } from './services/groups.service';
import { GroupsController } from './controllers/groups.controller';
import { GROUP_ROSTER_READER } from '../../shared/application/group-roster-reader.port';
import { SharedApplicationModule } from '../../shared/application/shared-application.module';
import { UsersModule } from '../users/users.module';
import { CourseGroupRepository } from './infrastructure/database/course-group.repository';
import { COURSE_GROUP_REPOSITORY } from './domain/repositories/course-group.repository.interface';
import { GroupEnrollmentRepository } from './infrastructure/database/group-enrollment.repository';
import { GROUP_ENROLLMENT_REPOSITORY } from './domain/repositories/group-enrollment.repository.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseGroup, GroupEnrollment]),
    SharedApplicationModule,
    UsersModule,
  ],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    {
      provide: GROUP_ROSTER_READER,
      useExisting: GroupsService,
    },
    {
      provide: COURSE_GROUP_REPOSITORY,
      useClass: CourseGroupRepository,
    },
    {
      provide: GROUP_ENROLLMENT_REPOSITORY,
      useClass: GroupEnrollmentRepository,
    },
  ],
  exports: [GroupsService, GROUP_ROSTER_READER],
})
export class AcademicModule {}
