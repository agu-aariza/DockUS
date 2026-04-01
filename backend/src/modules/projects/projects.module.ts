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
import { DeliveriesController } from './deliveries/deliveries.controller';
import { DeliveriesService } from './deliveries/deliveries.service';
import { Delivery } from './deliveries/entities/delivery.entity';
import { Project } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Delivery])],
  controllers: [ProjectsController, DeliveriesController],
  providers: [ProjectsService, DeliveriesService],
  exports: [ProjectsService, DeliveriesService],
})
export class ProjectsModule {}
