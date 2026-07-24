/**
 * @fileoverview Módulo académico de grupos y matrículas (academic.module).
 *
 * @module academic.module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseGroup } from './entities/course-group.entity';
import { GroupEnrollment } from './entities/group-enrollment.entity';
import { User } from '../users/entities/user.entity';
import { GroupsService } from './services/groups.service';
import { GroupsController } from './controllers/groups.controller';
import { GROUP_ROSTER_READER } from '../../shared/application/group-roster-reader.port';
import { SharedApplicationModule } from '../../shared/application/shared-application.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseGroup, GroupEnrollment, User]),
    SharedApplicationModule,
  ],
  controllers: [GroupsController],
  providers: [
    GroupsService,
    {
      provide: GROUP_ROSTER_READER,
      useExisting: GroupsService,
    },
  ],
  exports: [GroupsService, GROUP_ROSTER_READER],
})
export class AcademicModule {}
