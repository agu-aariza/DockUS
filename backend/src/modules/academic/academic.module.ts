import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseGroup } from './entities/course-group.entity';
import { GroupEnrollment } from './entities/group-enrollment.entity';
import { User } from '../users/entities/user.entity';
import { GroupsService } from './services/groups.service';
import { GroupsController } from './controllers/groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourseGroup, GroupEnrollment, User])],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class AcademicModule {}
