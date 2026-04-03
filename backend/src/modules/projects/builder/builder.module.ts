/**
 * @fileoverview Modulo Builder MVP dentro del dominio de proyectos.
 *
 * Contexto:
 * - Registra endpoint y servicio para pipeline Python-first.
 * - Reutiliza entidades de entregas y storage para recolectar artefactos.
 *
 * @module BuilderModule
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageInfrastructureModule } from '../../../shared/infrastructure/storage/storage-infrastructure.module';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { StorageObject } from '../storage/entities/storage-object.entity';
import { BuilderController } from './builder.controller';
import { BuilderService } from './builder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Delivery, StorageObject]),
    StorageInfrastructureModule,
  ],
  controllers: [BuilderController],
  providers: [BuilderService],
  exports: [BuilderService],
})
export class BuilderModule {}
