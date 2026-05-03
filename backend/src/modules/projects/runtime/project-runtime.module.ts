import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DockerInfrastructureModule } from '../../../shared/infrastructure/docker/docker-infrastructure.module';
import { BuildRun } from '../builder/domain/entities/build-run.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { Project } from '../entities/project.entity';
import { ProjectRuntimeService } from './project-runtime.service';

@Module({
  imports: [
    DockerInfrastructureModule,
    TypeOrmModule.forFeature([Project, BuildRun, Delivery]),
  ],
  controllers: [],
  providers: [ProjectRuntimeService],
  exports: [ProjectRuntimeService],
})
export class ProjectRuntimeModule {}
