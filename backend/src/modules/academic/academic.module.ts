import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseGroup } from './entities/course-group.entity';
import { GroupEnrollment } from './entities/group-enrollment.entity';
import { User } from '../users/entities/user.entity';
import { GroupsService } from './services/groups.service';
import { GroupsController } from './controllers/groups.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CourseGroup, GroupEnrollment, User]),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class AcademicModule {}
