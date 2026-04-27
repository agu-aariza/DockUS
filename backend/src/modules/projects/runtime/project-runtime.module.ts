import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuildRun } from '../builder/domain/entities/build-run.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { PROJECT_RUNTIME_QUEUE_NAME } from './project-runtime.constants';
import { ProjectRuntimeClusterService } from './project-runtime-cluster.service';
import { ProjectRuntimeController } from './project-runtime.controller';
import { ProjectRuntimeProcessor } from './project-runtime.processor';
import { ProjectRuntimeService } from './project-runtime.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PROJECT_RUNTIME_QUEUE_NAME,
    }),
    TypeOrmModule.forFeature([Project, BuildRun, Delivery]),
  ],
  controllers: [ProjectRuntimeController],
  providers: [
    ProjectRuntimeClusterService,
    ProjectRuntimeService,
    ProjectRuntimeProcessor,
  ],
  exports: [ProjectRuntimeService],
})
export class ProjectRuntimeModule {}
