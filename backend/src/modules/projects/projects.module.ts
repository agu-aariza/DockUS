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
import { ProjectAssignmentsController } from './assignments/project-assignments.controller';
import { ProjectAssignment } from './assignments/entities/project-assignment.entity';
import { ProjectAssignmentsService } from './assignments/project-assignments.service';
import { BuilderModule } from './builder/builder.module';
import { DeliveriesController } from './deliveries/deliveries.controller';
import { DeliveriesService } from './deliveries/deliveries.service';
import { Delivery } from './deliveries/entities/delivery.entity';
import { User } from '../users/entities/user.entity';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectAssignment, Delivery, User]),
    StorageModule,
    BuilderModule,
  ],
  controllers: [
    ProjectsController,
    DeliveriesController,
    ProjectAssignmentsController,
  ],
  providers: [ProjectsService, DeliveriesService, ProjectAssignmentsService],
  exports: [ProjectsService, DeliveriesService, ProjectAssignmentsService],
})
export class ProjectsModule {}
