/**
 * @fileoverview Módulo raíz del worker de procesamiento en segundo plano.
 *
 * Contexto:
 * - No expone servidor HTTP; consume jobs de BullMQ desde colas de trabajo.
 * - Importa la misma lógica de dominio e infraestructura que la API HTTP,
 *   pero añade exclusivamente los procesadores de jobs.
 *
 * @module AppWorkerModule
 */

import { Module } from '@nestjs/common';
import { AppModule } from './app.module';
import { BuilderProcessor } from './modules/projects/builder/presentation/builder.processor';

@Module({
  imports: [AppModule],
  providers: [BuilderProcessor],
})
export class AppWorkerModule {}
