/**
 * @fileoverview Módulo raíz del proceso Worker de procesamiento asíncrono.
 *
 * @description
 * Configura el contenedor de inyección de dependencias para el worker BullMQ.
 * Compone:
 * 1. `ProcessRoleModule.forRoot('worker')` para señalar la ejecución asíncrona.
 * 2. `CoreModule` con los servicios de infraestructura y dominio compartidos.
 * 3. `BuilderModule` para dar visibilidad directa a los servicios del pipeline.
 * 4. `BuilderProcessor` como provider receptor de los trabajos de encolamiento de ejecuciones.
 *
 * @module WorkerModule
 */

import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { BuilderModule } from './modules/projects/builder/builder.module';
import { BuilderProcessor } from './modules/projects/builder/presentation/builder.processor';
import { ProcessRoleModule } from './process-role.module';

/**
 * Módulo raíz para el proceso Worker asíncrono.
 */
@Module({
  imports: [ProcessRoleModule.forRoot('worker'), CoreModule, BuilderModule],
  providers: [BuilderProcessor],
})
export class WorkerModule {}
